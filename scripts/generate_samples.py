"""Generate 12 SYNTHETIC resumes (6 PDF + 6 DOCX) for demos and tests.

All people, companies and contact details are fictional (emails use example.com).
Usage:  python scripts/generate_samples.py [output_dir]
"""
from __future__ import annotations

import sys
from pathlib import Path

import docx
from docx.shared import Pt
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

# fmt: off
PEOPLE = [
 dict(name="Aarav Menon", title="Senior Backend Engineer", phone="+91 90000 10001", fmt="pdf",
  summary="Backend engineer building Python APIs and NLP services for HR-tech products.",
  skills="Python, FastAPI, PostgreSQL, SQL, Docker, AWS, Kubernetes, spaCy, Hugging Face, REST APIs, CI/CD, Pytest",
  jobs=[("Senior Backend Engineer","TalentLoop Systems","Mar 2021","Present",[
          "Designed FastAPI microservices serving 2M requests/day with PostgreSQL and Redis",
          "Built an NLP pipeline with spaCy and transformer models to extract skills from resumes",
          "Containerised services with Docker and deployed to Kubernetes on AWS using GitHub Actions"]),
        ("Python Developer","Brightwave Labs","Jun 2018","Feb 2021",[
          "Developed REST APIs in Flask and wrote unit tests with Pytest",
          "Optimised SQL queries and schema design for a 200 GB PostgreSQL database"])],
  edu="M.Tech in Computer Science, Fictional Institute of Technology, 2018", certs=["AWS Certified Developer - Associate"]),
 dict(name="Priya Nair", title="Python Developer", phone="+91 90000 10002", fmt="docx",
  summary="Python developer working on web backends and applied machine learning.",
  skills="Python, Flask, Postgres, Docker, scikit-learn, BERT, Git, REST",
  jobs=[("Python Developer","Cobalt Analytics","Jul 2022","Present",[
          "Built Flask REST services backed by Postgres and containerised with Docker",
          "Trained BERT-based text classifiers to categorise support tickets",
          "Wrote scikit-learn models for churn prediction"]),
        ("Junior Developer","Nimbus Soft","Aug 2020","Jun 2022",[
          "Maintained internal tools in Python and SQL",
          "Automated reports and fixed production bugs"])],
  edu="B.Tech in Information Technology, Fictional University, 2020", certs=[]),
 dict(name="Rohan Das", title="Software Engineer", phone="+91 90000 10003", fmt="pdf",
  summary="Software engineer focused on Django web applications.",
  skills="Python, Django, MySQL, Docker, REST APIs, Git, HTML, CSS",
  jobs=[("Software Engineer","Greenfield Web","Jan 2021","Present",[
          "Developed Django applications and RESTful services for e-commerce clients",
          "Containerized deployments and managed MySQL databases",
          "Wrote unit tests and participated in code reviews"]),
        ("Web Developer","PixelCraft","Jan 2020","Dec 2020",[
          "Built responsive front ends with HTML, CSS and JavaScript"])],
  edu="B.E. in Computer Science, Fictional College of Engineering, 2019", certs=[]),
 dict(name="Sneha Kulkarni", title="Java Developer", phone="+91 90000 10004", fmt="docx",
  summary="Java developer building enterprise microservices.",
  skills="Java, Spring Boot, Hibernate, SQL, Oracle, Microservices, Docker, Kafka, JUnit",
  jobs=[("Java Developer","Orbit Financial Tech","Apr 2020","Present",[
          "Built Spring Boot microservices processing payments with Kafka",
          "Tuned Oracle SQL queries and managed Hibernate mappings",
          "Containerised services with Docker and wrote JUnit tests"]),
        ("Associate Engineer","Metro Infosys Demo","Jun 2019","Mar 2020",[
          "Supported a Java banking application"])],
  edu="B.Tech in Computer Science, Fictional University, 2019", certs=[]),
 dict(name="Karthik Reddy", title="Fresher", phone="+91 90000 10005", fmt="pdf",
  summary="Final-year student looking for a Python backend internship; strong interest in NLP.",
  skills="Python, FastAPI, Hugging Face, SQLite, Git, Pandas",
  jobs=[("Backend Intern","Startify Demo","Jan 2025","Jun 2025",[
          "Built FastAPI endpoints for an internal tool",
          "Created an NLP prototype that clusters customer feedback using sentence embeddings"])],
  edu="B.Tech in Artificial Intelligence and Data Science, Fictional Institute, 2026", certs=["Hugging Face NLP Course"]),
 dict(name="Neha Sharma", title="Data Scientist", phone="+91 90000 10006", fmt="docx",
  summary="Data scientist focused on NLP research and applied machine learning.",
  skills="Python, PyTorch, NLP, Transformers, SQL, Pandas, scikit-learn, Statistics",
  jobs=[("Senior Data Scientist","Lexica AI","Feb 2020","Present",[
          "Fine-tuned transformer models for named entity recognition and text classification",
          "Wrote SQL and Pandas pipelines to prepare training data",
          "Presented experiment results to product teams"]),
        ("Data Scientist","Insightly Demo","Jan 2017","Jan 2020",[
          "Built sentiment analysis and topic models",
          "Developed machine learning models for demand forecasting"])],
  edu="M.Sc in Statistics, Fictional University, 2016", certs=[]),
 dict(name="Vikram Singh", title="Full Stack Developer", phone="+91 90000 10007", fmt="pdf",
  summary="Full stack JavaScript developer.",
  skills="JavaScript, TypeScript, Node.js, Express.js, React, MongoDB, AWS, Docker",
  jobs=[("Full Stack Developer","Zenith Apps","Aug 2018","Present",[
          "Built React front ends and Node.js REST APIs backed by MongoDB",
          "Deployed services on AWS using Docker"]),
        ("Web Developer","ByteBridge Demo","Jul 2016","Jul 2018",[
          "Created JavaScript web applications for small businesses"])],
  edu="B.Tech in Electronics, Fictional University, 2016", certs=[]),
 dict(name="Ananya Iyer", title="Backend Engineer", phone="+91 90000 10008", fmt="docx",
  summary="Backend engineer shipping Python services and semantic search features.",
  skills="Python, Flask, PostgreSQL, Docker, Kubernetes, AWS, CI/CD, FAISS, Sentence Transformers",
  jobs=[("Backend Engineer","Cartwheel Tech","Sep 2022","Present",[
          "Built a semantic search service using sentence embeddings and FAISS vector search",
          "Developed Flask REST APIs on PostgreSQL and deployed with Docker and Kubernetes on AWS",
          "Set up CI/CD pipelines with GitHub Actions and Pytest"])],
  edu="B.Tech in Computer Science, Fictional University, 2022", certs=[]),
 dict(name="Dev Patel", title="QA Automation Engineer", phone="+91 90000 10009", fmt="pdf",
  summary="QA automation engineer writing Python test scripts.",
  skills="Python, Selenium, Pytest, SQL, Jenkins, Git",
  jobs=[("QA Automation Engineer","Quantum Quality Demo","Jun 2023","Present",[
          "Automated regression suites with Selenium and Pytest",
          "Validated database results with SQL queries"])],
  edu="B.Sc in Computer Science, Fictional University, 2023", certs=[]),
 dict(name="Meera Joshi", title="Machine Learning Engineer", phone="+91 90000 10010", fmt="docx",
  summary="ML engineer building LLM applications and Python APIs.",
  skills="Python, FastAPI, LLMs, RAG, LangChain, pgvector, PostgreSQL, Docker, Azure, Prompt Engineering",
  jobs=[("Machine Learning Engineer","Helix Cognition","May 2021","Present",[
          "Built retrieval-augmented generation services with LangChain and pgvector on PostgreSQL",
          "Exposed LLM features through FastAPI endpoints, containerised with Docker on Azure",
          "Evaluated prompts and embedding models for recruiter search"]),
        ("Software Engineer","Plain Logic Demo","Jul 2019","Apr 2021",[
          "Developed Python REST APIs and SQL reporting jobs"])],
  edu="B.Tech in Computer Science, Fictional University, 2019", certs=[]),
 dict(name="Arjun Rao", title="DevOps Engineer", phone="+91 90000 10011", fmt="pdf",
  summary="DevOps engineer specialising in cloud infrastructure.",
  skills="Docker, Kubernetes, Terraform, AWS, Linux, Bash, Python, Jenkins, CI/CD",
  jobs=[("Lead DevOps Engineer","CloudNest Demo","Jan 2016","Present",[
          "Operated Kubernetes clusters on AWS and automated infrastructure with Terraform",
          "Built CI/CD pipelines in Jenkins and wrote Python and Bash automation"]),
        ("System Administrator","Datacore Demo","Jan 2014","Dec 2015",[
          "Managed Linux servers and backups"])],
  edu="B.Tech in Information Technology, Fictional University, 2013", certs=[]),
 dict(name="Isha Gupta", title="Backend Developer", phone="+91 90000 10012", fmt="docx",
  summary="Backend developer working on Django and data-heavy services.",
  skills="Python, Django, REST APIs, SQL Server, Celery, Redis, Git",
  jobs=[("Backend Developer","Summit Retail Tech","Mar 2022","Present",[
          "Built Django REST APIs and Celery workers backed by SQL Server",
          "Implemented text classification to tag product reviews using natural language techniques"]),
        ("Software Developer","Aster Demo","Mar 2021","Feb 2022",[
          "Maintained Python services and wrote SQL stored procedures"])],
  edu="B.Tech in Computer Science, Fictional University, 2021", certs=[]),
]
# fmt: on


def slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def contact(p: dict) -> str:
    s = slug(p["name"]).replace("_", ".")
    return f"{s}@example.com | {p['phone']} | github.com/{slug(p['name']).replace('_', '-')}-demo"


def write_pdf(p: dict, path: Path) -> None:
    ss = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=ss["Heading2"], spaceBefore=8, spaceAfter=2, fontSize=11)
    b = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9.5, leading=12)
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=36, bottomMargin=36)
    el = [Paragraph(f"<b>{p['name']}</b>", ParagraphStyle("t", parent=ss["Title"], fontSize=18, alignment=0)),
          Paragraph(contact(p), b), Spacer(1, 4),
          Paragraph("SUMMARY", h), Paragraph(p["summary"], b),
          Paragraph("SKILLS", h), Paragraph(p["skills"], b),
          Paragraph("EXPERIENCE", h)]
    for t, c, s, e, bullets in p["jobs"]:
        el.append(Paragraph(f"<b>{t}</b>, {c} &nbsp;&nbsp; {s} - {e}", b))
        for x in bullets:
            el.append(Paragraph("• " + x, b))
        el.append(Spacer(1, 4))
    el += [Paragraph("EDUCATION", h), Paragraph(p["edu"], b)]
    if p["certs"]:
        el += [Paragraph("CERTIFICATIONS", h)] + [Paragraph("• " + c, b) for c in p["certs"]]
    doc.build(el)


def write_docx(p: dict, path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(10.5)
    d.add_heading(p["name"], 0)
    d.add_paragraph(contact(p))
    d.add_heading("Profile", 2)
    d.add_paragraph(p["summary"])
    d.add_heading("Technical Skills", 2)
    d.add_paragraph(p["skills"])
    d.add_heading("Work Experience", 2)
    for t, c, s, e, bullets in p["jobs"]:
        d.add_paragraph(f"{t} | {c} | {s} - {e}").runs[0].bold = True
        for x in bullets:
            d.add_paragraph(x, style="List Bullet")
    d.add_heading("Education", 2)
    d.add_paragraph(p["edu"])
    if p["certs"]:
        d.add_heading("Certifications", 2)
        for c in p["certs"]:
            d.add_paragraph(c, style="List Bullet")
    d.save(path)


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for p in PEOPLE:
        path = out / f"{slug(p['name'])}.{p['fmt']}"
        (write_pdf if p["fmt"] == "pdf" else write_docx)(p, path)
    print(f"Wrote {len(PEOPLE)} resumes to {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "sample_data" / "resumes")
