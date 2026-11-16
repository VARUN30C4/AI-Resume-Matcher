"""FastAPI application."""
from __future__ import annotations

import csv
import io
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Candidate, Job, get_session, init_db
from .matching.scorer import WEIGHTS, prepare_jd, score_resume
from .nlp.embeddings import get_embedder
from .parsing.extract_text import UnsupportedFile, extract_text
from .parsing.jd_parser import parse_jd
from .parsing.resume_parser import parse_resume

logging.basicConfig(level=logging.INFO)
ROOT = Path(__file__).resolve().parents[2]
MAX_BATCH = 50

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    get_embedder()  # load the model once at boot so the first request is fast
    yield


app = FastAPI(title="AI Resume Matcher", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ helpers
def _get_job(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


def _job_out(job: Job) -> dict:
    return {"id": job.id, "title": job.title, "text": job.text, "parsed": job.parsed_json,
            "created_at": job.created_at.isoformat()}


class CandidateUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


def _row(rank: int, c: Candidate) -> dict:
    prof, res = c.profile_json, c.result_json
    bk = res.get("breakdown", {})
    return {
        "id": c.id, "rank": rank, "name": c.name, "filename": c.filename,
        "title": prof.get("current_title", ""),
        "experience_years": res["experience"]["candidate_years"],
        "relevant_years": res["experience"]["relevant_years"],
        "score": c.score, "label": res["label"],
        "matched_skills": [s["skill"] for s in res["matched_skills"]],
        "partial_skills": [s["skill"] for s in res["partial_skills"]],
        "missing_skills": [s["skill"] for s in res["missing_skills"]],
        "status": getattr(c, "status", "new") or "new",
        "notes": getattr(c, "notes", "") or "",
        "components": {
            k: round(bk[k]["score"] / 100.0, 4) if k in bk else 0.0
            for k in ("skills", "semantic", "experience", "education")
        },
        "skills_detail": {
            "matched": res.get("matched_skills", []),
            "partial": res.get("partial_skills", []),
            "missing": res.get("missing_skills", []),
        },
    }


def _ranking(db: Session, job_id: int) -> list[dict]:
    rows = db.scalars(select(Candidate).where(Candidate.job_id == job_id)
                      .order_by(Candidate.score.desc(), Candidate.id)).all()
    return [_row(i + 1, c) for i, c in enumerate(rows)]


# ------------------------------------------------------------------ routes
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/info")
def info() -> dict:
    e = get_embedder()
    return {"embedding_backend": e.kind, "embedding_model": e.name, "weights": WEIGHTS}


@app.get("/api/sample-jd")
def sample_jd() -> PlainTextResponse:
    p = ROOT / "sample_data" / "sample_jd.txt"
    if not p.exists():
        raise HTTPException(404, "No sample JD bundled")
    return PlainTextResponse(p.read_text(encoding="utf-8"))


@app.post("/api/jobs")
def create_job(text: str | None = Form(None), file: UploadFile | None = File(None),
               db: Session = Depends(get_session)) -> dict:
    """Create a job from pasted text or an uploaded PDF/DOCX/TXT job description."""
    jd_text = (text or "").strip()
    if file is not None and file.filename:
        try:
            jd_text = extract_text(file.filename, file.file.read())
        except UnsupportedFile as exc:
            raise HTTPException(400, str(exc))
    if len(jd_text) < 40:
        raise HTTPException(400, "Please provide a job description (at least a few lines).")
    jd_text = jd_text[:20000]
    profile = parse_jd(jd_text)
    job = Job(title=profile.title, text=jd_text, parsed=json.dumps(profile.to_dict()))
    db.add(job)
    db.commit()
    return _job_out(job)


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_session)) -> dict:
    return _job_out(_get_job(db, job_id))


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_session)) -> dict:
    db.delete(_get_job(db, job_id))
    db.commit()
    return {"deleted": job_id}


@app.post("/api/jobs/{job_id}/resumes")
def upload_resumes(job_id: int, files: list[UploadFile] = File(...),
                   db: Session = Depends(get_session)) -> dict:
    job = _get_job(db, job_id)
    if len(files) > MAX_BATCH:
        raise HTTPException(400, f"At most {MAX_BATCH} resumes per batch")
    jd = parse_jd(job.text)
    ctx = prepare_jd(jd, get_embedder())

    added, errors = [], []
    for f in files:
        name = Path(f.filename or "resume").name
        try:
            text = extract_text(name, f.file.read())
            profile = parse_resume(text, name)
            result = score_resume(ctx, profile)
        except UnsupportedFile as exc:
            errors.append({"filename": name, "error": str(exc)})
            continue
        except Exception as exc:  # corrupt file etc. must not fail the whole batch
            logging.exception("Failed to process %s", name)
            errors.append({"filename": name, "error": f"Could not process file ({exc.__class__.__name__})"})
            continue
        cand = Candidate(job_id=job.id, filename=name, name=profile.name, score=result["score"],
                         profile=json.dumps(profile.to_dict()), result=json.dumps(result), raw_text=text)
        db.add(cand)
        added.append(name)
    db.commit()
    return {"added": added, "errors": errors, "ranking": _ranking(db, job.id)}


@app.get("/api/jobs/{job_id}/ranking")
def ranking(job_id: int, db: Session = Depends(get_session)) -> dict:
    _get_job(db, job_id)
    return {"ranking": _ranking(db, job_id)}


@app.get("/api/jobs/{job_id}/candidates/{cid}")
def candidate_detail(job_id: int, cid: int, db: Session = Depends(get_session)) -> dict:
    job = _get_job(db, job_id)
    c = db.get(Candidate, cid)
    if not c or c.job_id != job.id:
        raise HTTPException(404, "Candidate not found")
    rank = next(r["rank"] for r in _ranking(db, job.id) if r["id"] == c.id)
    return {
        "id": c.id, "rank": rank, "filename": c.filename, "profile": c.profile_json,
        "result": c.result_json, "job": job.parsed_json,
        "status": getattr(c, "status", "new") or "new",
        "notes": getattr(c, "notes", "") or "",
    }


@app.patch("/api/jobs/{job_id}/candidates/{cid}")
def update_candidate(job_id: int, cid: int, payload: CandidateUpdate,
                     db: Session = Depends(get_session)) -> dict:
    job = _get_job(db, job_id)
    c = db.get(Candidate, cid)
    if not c or c.job_id != job.id:
        raise HTTPException(404, "Candidate not found")
    if payload.status is not None:
        val = payload.status.strip().lower()
        if val not in {"new", "shortlisted", "rejected"}:
            raise HTTPException(400, "Status must be 'new', 'shortlisted', or 'rejected'")
        c.status = val
    if payload.notes is not None:
        c.notes = payload.notes.strip()
    db.commit()
    rank = next((r["rank"] for r in _ranking(db, job.id) if r["id"] == c.id), 1)
    return _row(rank, c)


@app.get("/api/jobs/{job_id}/candidates/{cid}/report.html")
def candidate_report(job_id: int, cid: int, db: Session = Depends(get_session)) -> HTMLResponse:
    job = _get_job(db, job_id)
    c = db.get(Candidate, cid)
    if not c or c.job_id != job.id:
        raise HTTPException(404, "Candidate not found")
    prof, res = c.profile_json, c.result_json
    rank = next((r["rank"] for r in _ranking(db, job.id) if r["id"] == c.id), 1)

    matched_chips = "".join(f'<span class="chip chip-ok">{s["skill"]}</span>' for s in res.get("matched_skills", [])) or "None"
    partial_chips = "".join(f'<span class="chip chip-partial">{s["skill"]} <small>(via {s.get("via", s["skill"])})</small></span>' for s in res.get("partial_skills", [])) or "None"
    missing_chips = "".join(f'<span class="chip chip-miss {chr(34) + "chip-reqmiss" + chr(34) if s.get("required") else ""}">{s["skill"]}{" *" if s.get("required") else ""}</span>' for s in res.get("missing_skills", [])) or "None"

    breakdown_rows = "".join(
        f'<tr><td>{k.title()}</td><td>{v["weight"]}%</td><td>{v["score"]}%</td><td><strong>{v["points"]} pts</strong></td></tr>'
        for k, v in res.get("breakdown", {}).items()
    )

    reasons_list = "".join(f'<li>{r}</li>' for r in res.get("reasons", []))
    evidence_cards = "".join(
        f'<div class="evid-card"><div class="evid-sim">{e["similarity"]}% Similarity Match</div>'
        f'<div><strong>JD Requirement:</strong> {e["jd_line"]}</div>'
        f'<div><strong>Resume Evidence:</strong> {e["resume_line"]}</div></div>'
        for e in res.get("evidence", [])
    ) or "<p class='muted'>No semantic evidence recorded.</p>"

    notes_html = f'<div class="section"><div class="section-title">Recruiter Notes</div><p style="background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--line); margin: 0;">{c.notes}</p></div>' if getattr(c, "notes", "") else ""

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Candidate Report - {prof.get("name", c.name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {{
      --bg: #f8fafc; --card: #ffffff; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0;
      --brand: #2563eb; --good: #059669; --ok: #0284c7; --mid: #d97706; --low: #dc2626;
    }}
    body {{ font-family: Inter, system-ui, -apple-system, sans-serif; margin: 0; padding: 32px 16px; background: var(--bg); color: var(--ink); line-height: 1.5; font-size: 14px; }}
    .container {{ max-width: 800px; margin: 0 auto; background: var(--card); padding: 32px; border-radius: 12px; border: 1px solid var(--line); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .head {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 20px; margin-bottom: 24px; }}
    .name {{ margin: 0 0 4px; font-size: 26px; font-weight: 700; }}
    .role {{ color: var(--muted); font-size: 15px; margin: 0 0 8px; }}
    .score-box {{ text-align: right; }}
    .score-num {{ font-size: 38px; font-weight: 800; color: var(--brand); line-height: 1; }}
    .score-label {{ font-size: 13px; font-weight: 600; color: var(--good); margin-top: 4px; }}
    .section {{ margin-bottom: 24px; }}
    .section-title {{ font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 10px; border-bottom: 1px solid var(--line); padding-bottom: 4px; font-weight: 700; }}
    .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 13.5px; }}
    th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }}
    th {{ color: var(--muted); font-size: 12px; text-transform: uppercase; }}
    .chips {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }}
    .chip {{ font-size: 12px; padding: 2px 8px; border-radius: 999px; }}
    .chip-ok {{ background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }}
    .chip-partial {{ background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }}
    .chip-miss {{ background: #fef2f2; color: #b91c1c; border: 1px dashed #fca5a5; }}
    .chip-reqmiss {{ background: #fee2e2; border-style: solid; font-weight: 700; }}
    .evid-card {{ background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 13px; }}
    .evid-sim {{ font-size: 11px; font-weight: 700; color: var(--brand); margin-bottom: 4px; }}
    .actions {{ display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px; }}
    .btn {{ background: var(--brand); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; font-size: 13px; }}
    .footer-note {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--muted); text-align: center; }}
    @media print {{
      body {{ background: #fff; padding: 0; }}
      .container {{ border: none; box-shadow: none; padding: 0; max-width: 100%; }}
      .no-print {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="actions no-print">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="head">
      <div>
        <h1 class="name">{prof.get("name", c.name)}</h1>
        <div class="role">{prof.get("current_title", "") or c.filename} · Target Job: {job.title or "Target Role"}</div>
        <div style="font-size: 12.5px; color: var(--muted);">Email: {prof.get("email", "—")} | Phone: {prof.get("phone", "—")} | Status: {getattr(c, "status", "new").title()}</div>
      </div>
      <div class="score-box">
        <div class="score-num">{round(c.score)}%</div>
        <div class="score-label">{res.get("label", "")} · Rank #{rank}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Score Breakdown (100 Points Scale)</div>
      <table>
        <thead><tr><th>Component</th><th>Weight</th><th>Performance</th><th>Points Contributed</th></tr></thead>
        <tbody>{breakdown_rows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Skills Assessment</div>
      <div style="margin-bottom: 8px;"><strong>Fully Matched Skills:</strong><div class="chips">{matched_chips}</div></div>
      <div style="margin-bottom: 8px;"><strong>Partial Credit Skills:</strong><div class="chips">{partial_chips}</div></div>
      <div><strong>Missing Skills (* Required):</strong><div class="chips">{missing_chips}</div></div>
    </div>

    <div class="section grid-2">
      <div>
        <div class="section-title">Experience Timeline</div>
        <p><strong>Candidate Total:</strong> {res.get("experience", {}).get("candidate_years", 0)} years</p>
        <p><strong>Relevant Experience:</strong> {res.get("experience", {}).get("relevant_years", 0)} years</p>
        <p><strong>Required by JD:</strong> {res.get("experience", {}).get("required_years") or "None specified"} years</p>
      </div>
      <div>
        <div class="section-title">Education Alignment</div>
        <p><strong>Candidate Degree:</strong> {res.get("education", {}).get("candidate", "None detected")}</p>
        <p><strong>Required Degree:</strong> {res.get("education", {}).get("required", "Not specified")}</p>
      </div>
    </div>

    {notes_html}

    <div class="section">
      <div class="section-title">Assessment Rationale</div>
      <ul style="margin: 0; padding-left: 20px;">{reasons_list}</ul>
    </div>

    <div class="section">
      <div class="section-title">Strongest Semantic Evidence</div>
      {evidence_cards}
    </div>

    <div class="footer-note">
      This AI Resume Matcher report provides objective decision-support analysis based on skills taxonomy, verified career milestones, and semantic text alignment. It is designed to assist human recruiters, not replace hiring judgment.
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@app.delete("/api/jobs/{job_id}/candidates")
def clear_candidates(job_id: int, db: Session = Depends(get_session)) -> dict:
    job = _get_job(db, job_id)
    for c in list(job.candidates):
        db.delete(c)
    db.commit()
    return {"ranking": []}


@app.get("/api/jobs/{job_id}/export.csv")
def export_csv(job_id: int, db: Session = Depends(get_session)) -> PlainTextResponse:
    _get_job(db, job_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Rank", "Candidate", "Experience (yrs)", "Relevant (yrs)", "Match %", "Label",
                "Matched skills", "Missing skills"])
    for r in _ranking(db, job_id):
        w.writerow([r["rank"], r["name"], r["experience_years"], r["relevant_years"], r["score"], r["label"],
                    ", ".join(r["matched_skills"]), ", ".join(r["missing_skills"])])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="ranking_{job_id}.csv"'})


# Serve the built React app (frontend/dist) from the same origin when present.
_dist = ROOT / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
