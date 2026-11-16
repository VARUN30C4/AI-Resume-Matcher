"""Heading detection + section splitting shared by the resume and JD parsers."""
from __future__ import annotations

import re

RESUME_HEADINGS = {
    "summary": ["summary", "professional summary", "profile", "objective", "career objective", "about me", "about"],
    "experience": ["experience", "work experience", "professional experience", "employment", "employment history",
                   "work history", "internships", "internship experience", "relevant experience"],
    "education": ["education", "academic background", "academics", "qualifications", "education and training"],
    "skills": ["skills", "technical skills", "core competencies", "technologies", "key skills", "tech stack",
               "skills and tools", "tools and technologies"],
    "projects": ["projects", "personal projects", "academic projects", "key projects", "selected projects"],
    "certifications": ["certifications", "certificates", "licenses", "courses", "training"],
    "other": ["achievements", "awards", "publications", "interests", "languages", "hobbies", "references",
              "extracurricular", "volunteering", "activities"],
}

JD_HEADINGS = {
    "required": ["requirements", "required", "required skills", "must have", "must-have", "qualifications",
                 "required qualifications", "minimum qualifications", "what we're looking for", "what you bring",
                 "what you'll need", "skills required", "who you are", "basic qualifications", "key requirements",
                 "technical requirements", "required experience"],
    "preferred": ["preferred", "preferred qualifications", "nice to have", "nice-to-have", "good to have",
                  "bonus", "bonus points", "plus", "preferred skills", "desirable", "pluses", "optional"],
    "responsibilities": ["responsibilities", "key responsibilities", "what you'll do", "role", "the role",
                         "duties", "about the role", "job description", "what you will do", "your responsibilities"],
    "about": ["about us", "about the company", "company", "benefits", "perks", "what we offer", "overview"],
}


def _heading_key(line: str, table: dict[str, list[str]]) -> str | None:
    clean = re.sub(r"^[\W_]+|[\W_]+$", "", line.strip()).lower()
    clean = re.sub(r"\s+", " ", clean)
    if not clean or len(clean) > 45:
        return None
    for key, names in table.items():
        if clean in names:
            return key
    # "Required Skills (must have)" style: starts with a known heading
    for key, names in table.items():
        for n in names:
            if len(n) >= 6 and clean.startswith(n) and len(clean) <= len(n) + 18 and not line.rstrip().endswith("."):
                return key
    return None


def split_sections(text: str, table: dict[str, list[str]]) -> tuple[dict[str, str], str]:
    """Return ({section: text}, header_text_before_first_heading)."""
    sections: dict[str, list[str]] = {}
    header: list[str] = []
    current: str | None = None
    for line in text.splitlines():
        key = _heading_key(line, table) if line.strip() else None
        if key:
            current = key
            sections.setdefault(key, [])
            continue
        if current is None:
            header.append(line)
        else:
            sections[current].append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items()}, "\n".join(header).strip()


def bullet_lines(block: str, min_len: int = 12) -> list[str]:
    out = []
    for line in block.splitlines():
        line = re.sub(r"^\s*(?:[•\-\*•▪►·]|\d+[.)])\s*", "", line).strip()
        if len(line) >= min_len:
            out.append(line)
    return out
