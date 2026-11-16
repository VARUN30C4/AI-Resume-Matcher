"""Job description parser: required/preferred skills, experience, education, requirement lines."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from ..nlp.skills import GROUP_SEP, category_of, extract_skills, skill_mentions
from .resume_parser import DEGREES, LEVEL_LABEL
from .sections import JD_HEADINGS, bullet_lines, split_sections

YEARS_RX = re.compile(
    r"(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|to)\s*(\d{1,2})\s*)?(?:\+\s*)?(?:years?|yrs?)\b", re.I)
PREFERRED_CUES = re.compile(r"\b(?:nice to have|preferred|bonus|a plus|is a plus|good to have|desirable|"
                            r"familiarity with|exposure to|advantage)\b", re.I)


@dataclass
class JDProfile:
    title: str = ""
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)
    min_years: float | None = None
    education_level: int = 0
    requirements: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    text: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("text", None)
        d["education_label"] = LEVEL_LABEL[self.education_level]
        return d

    @property
    def chunks(self) -> list[str]:
        """Lines compared semantically against resume evidence."""
        lines = (self.requirements + self.responsibilities)[:30]
        if not lines:
            lines = bullet_lines(self.text, 25)[:30]
        return lines


_GAP_OR = re.compile(r"^\s*(?:,?\s*or\s+|/|\s+or\s+)\s*$", re.I)
_GAP_COMMA = re.compile(r"^\s*,\s*$")


def find_or_groups(text: str) -> list[list[str]]:
    """Alternatives such as "FastAPI, Flask or Django" or "AWS/Azure/GCP" (same-category skills only)."""
    groups: list[list[str]] = []
    for line in text.splitlines():
        ms = skill_mentions(line)
        i = 0
        while i < len(ms) - 1:
            gap = line[ms[i][1]:ms[i + 1][0]]
            if _GAP_OR.match(gap):
                # walk back over comma-separated siblings of the same category
                j = i
                while j > 0 and _GAP_COMMA.match(line[ms[j - 1][1]:ms[j][0]]) \
                        and category_of(ms[j - 1][2]) == category_of(ms[i][2]):
                    j -= 1
                members = [m[2] for m in ms[j:i + 1]]
                k = i + 1
                members.append(ms[k][2])
                # "/"-chains: A/B/C
                while k + 1 < len(ms) and _GAP_OR.match(line[ms[k][1]:ms[k + 1][0]]):
                    k += 1
                    members.append(ms[k][2])
                if len(set(members)) > 1 and len({category_of(m) for m in members}) == 1:
                    groups.append(list(dict.fromkeys(members)))
                i = k
            else:
                i += 1
    return groups


def _apply_groups(bucket: dict[str, int], groups: list[list[str]]) -> None:
    for g in groups:
        if all(m in bucket for m in g):
            cnt = max(bucket.pop(m) for m in g)
            bucket[GROUP_SEP.join(g)] = cnt


def _min_years(text: str) -> float | None:
    vals = []
    for line in text.splitlines():
        if "experience" not in line.lower():
            continue
        if PREFERRED_CUES.search(line):
            continue
        for m in YEARS_RX.finditer(line):
            n = int(m.group(1))
            if 0 < n <= 20:
                vals.append(n)
    if not vals:
        for m in re.finditer(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){0,3}?experience", text, re.I):
            vals.append(int(m.group(1)))
    return float(max(vals)) if vals else None


def parse_jd(text: str) -> JDProfile:
    p = JDProfile(text=text)
    sections, header = split_sections(text, JD_HEADINGS)

    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    p.title = re.sub(r"^(?:job\s*title|position|role)\s*[:\-]\s*", "", first, flags=re.I)[:120]

    req_text = sections.get("required", "")
    pref_text = sections.get("preferred", "")
    resp_text = sections.get("responsibilities", "")

    req = extract_skills(req_text) if req_text else {}
    pref = extract_skills(pref_text) if pref_text else {}
    # skills mentioned elsewhere (header / responsibilities) are required unless the line has a "nice to have" cue
    rest_text = "\n".join(v for k, v in sections.items() if k in ("responsibilities",)) + "\n" + header
    for line in rest_text.splitlines():
        sk = extract_skills(line)
        # when the JD has an explicit requirements section, skills only seen in the
        # responsibilities/header are "nice to have" signals, not hard requirements
        target = pref if (PREFERRED_CUES.search(line) or req_text) else req
        for s in sk:
            target.setdefault(s, 1)
    # a "required" line carrying a preferred cue (e.g. "AWS is a plus") demotes that skill
    for line in req_text.splitlines():
        if PREFERRED_CUES.search(line):
            for s in extract_skills(line):
                req.pop(s, None)
                pref.setdefault(s, 1)
    if not req and not pref:
        req = extract_skills(text)
    groups = find_or_groups(text)
    _apply_groups(req, groups)
    _apply_groups(pref, groups)
    p.required_skills = sorted(req, key=lambda s: -req[s])
    p.preferred_skills = [s for s in sorted(pref, key=lambda s: -pref[s]) if s not in req]

    p.min_years = _min_years(text)

    level = 0
    for lvl, _lbl, rx in DEGREES:
        for line in text.splitlines():
            if re.search(rx, line, re.I) and re.search(r"degree|bachelor|master|phd|diploma|b\.?tech|m\.?tech|education|qualification", line, re.I):
                # "Bachelor's or Master's" -> the lower one is the minimum
                level = lvl if level == 0 else min(level, lvl)
                break
    p.education_level = level

    p.requirements = bullet_lines(req_text, 15)
    p.responsibilities = bullet_lines(resp_text, 15)
    return p
