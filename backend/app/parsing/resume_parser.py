"""Rule-based resume parser: contact details, skills, experience timeline, education."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date

from ..nlp.skills import extract_skills
from .sections import RESUME_HEADINGS, bullet_lines, split_sections

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}

_MON = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATE = rf"(?:{_MON}\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
_PRESENT = r"(?:present|current|now|till\s+date|to\s+date|ongoing)"
RANGE_RX = re.compile(rf"(?P<s>{_DATE})\s*(?:-|to|until)\s*(?P<e>{_DATE}|{_PRESENT})", re.I)

EMAIL_RX = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RX = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,5}\)?[\s\-.]?)?\d{3,5}[\s\-.]?\d{3,5}(?!\d)")
EXPLICIT_YEARS_RX = re.compile(r"(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b(?:\s+of)?\s+(?:\w+\s+){0,3}?experience", re.I)

TITLE_WORDS = ("engineer", "developer", "analyst", "scientist", "intern", "manager", "consultant", "architect",
               "lead", "specialist", "administrator", "programmer", "researcher", "associate", "trainee", "designer")

DEGREES = [  # (level, label, regex)
    (4, "PhD", r"\b(?:ph\.?\s?d|doctorate|doctor of philosophy)\b"),
    (3, "Master's", r"\b(?:master'?s?|m\.?\s?tech|m\.?\s?sc|m\.?\s?s\b|m\.?\s?e\b|mba|mca|m\.?\s?eng)\b"),
    (2, "Bachelor's", r"\b(?:bachelor'?s?|b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|b\.?\s?s\b|bca|b\.?\s?eng|b\.?\s?a\b|undergraduate)\b"),
    (1, "Diploma", r"\b(?:diploma|associate degree|polytechnic)\b"),
]
LEVEL_LABEL = {0: "Not specified", 1: "Diploma", 2: "Bachelor's", 3: "Master's", 4: "PhD"}


@dataclass
class ExperienceEntry:
    start: str
    end: str
    months: int
    text: str = ""
    title: str = ""


@dataclass
class ResumeProfile:
    name: str = ""
    email: str = ""
    phone: str = ""
    links: list[str] = field(default_factory=list)
    current_title: str = ""
    summary: str = ""
    skills: dict[str, int] = field(default_factory=dict)       # canonical -> mentions
    listed_skills: list[str] = field(default_factory=list)      # found in the skills section
    experience_years: float = 0.0
    experience_source: str = "none"                              # dates | stated | none
    entries: list[ExperienceEntry] = field(default_factory=list)
    education_level: int = 0
    education: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    text: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("text", None)
        d["education_label"] = LEVEL_LABEL[self.education_level]
        return d


def _parse_date(s: str, end: bool = False) -> tuple[int, int]:
    s = s.strip().lower()
    today = date.today()
    if re.fullmatch(_PRESENT, s):
        return today.year, today.month
    m = re.match(rf"({_MON})\s+(\d{{4}})", s)
    if m:
        return int(m.group(2)), MONTHS[m.group(1)[:3]]
    m = re.match(r"(\d{1,2})/(\d{4})", s)
    if m:
        return int(m.group(2)), min(12, max(1, int(m.group(1))))
    y = int(s[:4])
    return y, (12 if end else 1)


def _months_between(a: tuple[int, int], b: tuple[int, int]) -> int:
    return (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1


def _merge(intervals: list[tuple[int, int]]) -> int:
    """Total months covered by a set of [start,end] month-index intervals (overlaps counted once)."""
    if not intervals:
        return 0
    intervals = sorted(intervals)
    total, (cs, ce) = 0, intervals[0]
    for s, e in intervals[1:]:
        if s <= ce + 1:
            ce = max(ce, e)
        else:
            total += ce - cs + 1
            cs, ce = s, e
    return total + ce - cs + 1


def _idx(ym: tuple[int, int]) -> int:
    return ym[0] * 12 + ym[1]


def _guess_name(header: str, email: str, filename: str) -> str:
    for line in [l.strip() for l in header.splitlines() if l.strip()][:6]:
        if "@" in line or re.search(r"https?://|www\.|linkedin|github", line, re.I):
            continue
        if sum(c.isdigit() for c in line) > 2 or not (3 <= len(line) <= 40):
            continue
        words = line.replace(",", " ").split()
        if 2 <= len(words) <= 4 and all(re.fullmatch(r"[A-Za-z.'\-]+", w) for w in words):
            if any(w.lower() in {"resume", "curriculum", "vitae", "cv", "profile"} for w in words):
                continue
            return " ".join(w.capitalize() if w.isupper() else w for w in words)
    if email:
        local = re.split(r"[._\-\d]+", email.split("@")[0])
        local = [p for p in local if p]
        if local:
            return " ".join(p.capitalize() for p in local[:3])
    stem = re.sub(r"\.[A-Za-z]+$", "", filename)
    return re.sub(r"[_\-]+", " ", stem).strip().title() or "Unknown"


def _education(block: str, whole_text: str) -> tuple[int, list[str]]:
    src = block or whole_text
    lines = [l.strip() for l in src.splitlines() if l.strip()]
    found, best = [], 0
    for line in lines:
        for level, _label, rx in DEGREES:
            if re.search(rx, line, re.I):
                best = max(best, level)
                if len(found) < 3 and line not in found:
                    found.append(line[:140])
                break
    return best, found


def parse_resume(text: str, filename: str = "") -> ResumeProfile:
    p = ResumeProfile(text=text)
    sections, header = split_sections(text, RESUME_HEADINGS)

    m = EMAIL_RX.search(text)
    p.email = m.group(0) if m else ""
    for pm in PHONE_RX.finditer(header or text[:400]):
        digits = re.sub(r"\D", "", pm.group(0))
        if 10 <= len(digits) <= 13:
            p.phone = pm.group(0).strip()
            break
    p.links = sorted({u.rstrip(".,)") for u in re.findall(r"(?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com)/[\w\-./]+", text, re.I)})
    p.name = _guess_name(header or text[:300], p.email, filename)

    p.summary = (sections.get("summary") or "")[:500]
    p.skills = extract_skills(text)
    if sections.get("skills"):
        p.listed_skills = sorted(extract_skills(sections["skills"]))

    # ---- experience timeline
    exp_block = sections.get("experience", "")
    scan = exp_block
    if not scan:  # no heading: scan everything except obvious education lines
        scan = "\n".join(l for l in text.splitlines()
                         if not any(re.search(rx, l, re.I) for _, _, rx in DEGREES))
    matches = list(RANGE_RX.finditer(scan))
    intervals: list[tuple[int, int]] = []
    for i, mt in enumerate(matches):
        try:
            s = _parse_date(mt.group("s"))
            e = _parse_date(mt.group("e"), end=True)
        except Exception:
            continue
        if _idx(e) < _idx(s) or s[0] < 1980 or s[0] > date.today().year + 1:
            continue
        line_start = scan.rfind("\n", 0, mt.start()) + 1
        nxt = matches[i + 1] if i + 1 < len(matches) else None
        end_pos = (scan.rfind("\n", 0, nxt.start()) + 1) if nxt else len(scan)
        body = scan[line_start:max(end_pos, mt.end())]
        title = ""
        for l in body.splitlines()[:3]:
            if any(w in l.lower() for w in TITLE_WORDS) and len(l) < 90:
                title = RANGE_RX.sub("", l).strip(" -|,()")
                break
        p.entries.append(ExperienceEntry(
            start=f"{s[0]}-{s[1]:02d}", end=f"{e[0]}-{e[1]:02d}",
            months=_months_between(s, e), text=body, title=title))
        intervals.append((_idx(s), _idx(e)))
    if intervals:
        p.experience_years = round(_merge(intervals) / 12, 1)
        p.experience_source = "dates"
    else:
        ys = [float(x) for x in EXPLICIT_YEARS_RX.findall(text)]
        if ys:
            p.experience_years = max(ys)
            p.experience_source = "stated"

    # ---- current title
    for e in p.entries:
        if e.title:
            p.current_title = e.title
            break
    if not p.current_title:
        for l in (exp_block or text).splitlines()[:25]:
            if any(w in l.lower() for w in TITLE_WORDS) and 4 < len(l) < 80 and not l.startswith(("•", "-")):
                p.current_title = RANGE_RX.sub("", l).strip(" -|,()")
                break

    p.education_level, p.education = _education(sections.get("education", ""), text)
    p.certifications = bullet_lines(sections.get("certifications", ""), 6)[:6]
    return p


def resume_chunks(p: ResumeProfile, limit: int = 60) -> list[str]:
    """Evidence lines used for semantic comparison (experience / projects / summary bullets)."""
    sections, _ = split_sections(p.text, RESUME_HEADINGS)
    lines: list[str] = []
    for key in ("summary", "experience", "projects"):
        lines += bullet_lines(sections.get(key, ""), 25)
    if len(lines) < 4:
        lines = bullet_lines(p.text, 25)
    return lines[:limit]
