from app.nlp.skills import extract_skills, skill_credit
from app.parsing.jd_parser import parse_jd
from app.parsing.resume_parser import parse_resume

RESUME = """Jane Q Public
jane.public@example.com | +1 415 555 0134 | github.com/janedemo

SUMMARY
Backend developer.

SKILLS
Python, FastAPI, Postgres, Docker

EXPERIENCE
Backend Developer, Acme Demo   Jan 2020 - Dec 2021
• Built REST services in FastAPI
Senior Developer, Beta Demo   Jun 2021 - Jun 2023
• Led a team and shipped Docker based deployments

EDUCATION
B.Tech in Computer Science, Demo University, 2019 - 2023
"""


def test_skill_aliases_and_false_friends():
    s = extract_skills("Built with JavaScript, Node.js and PostgreSQL (postgres). Spring 2021 semester. C++ too.")
    assert "JavaScript" in s and "Node.js" in s and "PostgreSQL" in s and "C++" in s
    assert "Java" not in s            # JavaScript must not count as Java
    assert "Spring" not in s          # "Spring 2021" is a season, not the framework


def test_resume_contact_and_overlapping_experience():
    p = parse_resume(RESUME, "jane.pdf")
    assert p.name == "Jane Q Public"
    assert p.email == "jane.public@example.com"
    assert "555" in p.phone
    # Jan 2020 - Jun 2023 with the 2021 overlap counted once = 3.5 years (not 4.0)
    assert p.experience_years == 3.5
    assert p.education_level == 2     # the education date range must not count as experience


def test_stated_years_fallback():
    p = parse_resume("Sam Roe\nsam@example.com\nI have 6 years of professional experience in Java and SQL.", "x.pdf")
    assert p.experience_years == 6 and p.experience_source == "stated"


def test_skill_credit_tiers():
    assert skill_credit("PostgreSQL", {"PostgreSQL"})[:2] == (1.0, "exact")
    assert skill_credit("SQL", {"PostgreSQL"})[:2] == (0.8, "implied")
    assert skill_credit("FastAPI", {"Flask"})[:2] == (0.5, "related")
    assert skill_credit("FastAPI / Flask / Django", {"Flask"})[:2] == (1.0, "exact")
    assert skill_credit("Kubernetes", {"Java"})[0] == 0.0


def test_jd_parsing(jd_text):
    jd = parse_jd(jd_text)
    assert jd.min_years == 3.0
    assert jd.education_level == 2
    assert {"Python", "SQL", "PostgreSQL", "Docker", "NLP"} <= set(jd.required_skills)
    assert "FastAPI / Flask / Django" in jd.required_skills
    assert {"AWS", "Kubernetes", "RAG"} <= set(jd.preferred_skills)
    assert not set(jd.required_skills) & set(jd.preferred_skills)


def test_pdf_cid_bullets_are_cleaned():
    from app.parsing.extract_text import normalize
    assert "cid" not in normalize("CERTIFICATIONS\n(cid:127) AWS Certified Developer")
