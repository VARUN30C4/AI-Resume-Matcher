"""Hybrid JD <-> resume scoring.

Final score (0-100) = 100 * (0.45*skills + 0.25*semantic + 0.20*experience + 0.10*education)

skills      weighted coverage of JD skills. Required skills weigh 2, preferred 1.
            Credit per skill: exact 1.0 | implied by a more specific skill 0.8 |
            related (same family) 0.5 | embedding-similar <= 0.4.
semantic    for every JD requirement/responsibility line, the cosine similarity to the
            best matching resume evidence line, calibrated to 0-1 and averaged.
experience  0.5 * (total years / required) + 0.5 * (relevant years / required), capped at 1.
education   1.0 if the candidate meets the JD level, 0.6 one level below, 0.3 otherwise.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from ..nlp.embeddings import Embedder
from ..nlp.skills import skill_credit, taxonomy
from ..parsing.jd_parser import JDProfile
from ..parsing.resume_parser import LEVEL_LABEL, ResumeProfile, resume_chunks

WEIGHTS = {"skills": 0.45, "semantic": 0.25, "experience": 0.20, "education": 0.10}
REQUIRED_WEIGHT, PREFERRED_WEIGHT = 2.0, 1.0
EMBED_SKILL_THRESHOLD = 0.78
EMBED_SKILL_MAX_CREDIT = 0.4


def label_for(score: float) -> str:
    if score >= 75:
        return "Strong match"
    if score >= 60:
        return "Good match"
    if score >= 40:
        return "Partial match"
    return "Weak match"


def _lexical_false_friend(a: str, b: str) -> bool:
    a, b = a.lower().replace(" ", ""), b.lower().replace(" ", "")
    return a in b or b in a  # Java vs JavaScript, SQL vs PostgreSQL handled by taxonomy instead


def _skill_scores(jd: JDProfile, resume: ResumeProfile, emb: Embedder) -> dict:
    resume_set = set(resume.skills)
    rows = []
    jd_all = [(s, True) for s in jd.required_skills] + [(s, False) for s in jd.preferred_skills]

    # embedding fallback only for skills still unmatched after the taxonomy pass
    unmatched = []
    for s, req in jd_all:
        credit, kind, via = skill_credit(s, resume_set)
        rows.append({"skill": s, "required": req, "credit": credit, "kind": kind, "via": via})
        if credit == 0 and " / " not in s:
            unmatched.append(s)
    if unmatched and resume_set and emb.supports_skill_similarity:
        pool = sorted(resume_set)
        vecs = emb.encode(unmatched + pool)
        u, r = vecs[: len(unmatched)], vecs[len(unmatched):]
        sims = u @ r.T
        for i, s in enumerate(unmatched):
            j = int(np.argmax(sims[i]))
            sim = float(sims[i, j])
            if sim >= EMBED_SKILL_THRESHOLD and not _lexical_false_friend(s, pool[j]):
                row = next(x for x in rows if x["skill"] == s)
                row.update(credit=round(EMBED_SKILL_MAX_CREDIT * (sim - EMBED_SKILL_THRESHOLD) /
                                        (1 - EMBED_SKILL_THRESHOLD) + 0.2, 2),
                           kind="semantic", via=pool[j])

    total_w = sum(REQUIRED_WEIGHT if r["required"] else PREFERRED_WEIGHT for r in rows)
    got = sum((REQUIRED_WEIGHT if r["required"] else PREFERRED_WEIGHT) * r["credit"] for r in rows)
    return {"rows": rows, "score": (got / total_w) if total_w else None}


def _relevant_years(jd: JDProfile, resume: ResumeProfile) -> float:
    """Years of experience weighted by how much each job overlaps with the JD's required skills."""
    from ..nlp.skills import extract_skills

    req = set(jd.required_skills) | set(jd.preferred_skills)
    if not req or not resume.entries:
        return resume.experience_years if not req else 0.0
    target = max(1, math.ceil(0.35 * len(jd.required_skills or list(req))))
    total = 0.0
    for e in resume.entries:
        hits = 0.0
        found = set(extract_skills(e.text))
        for s in (jd.required_skills or list(req)):
            credit, _k, _v = skill_credit(s, found)
            hits += credit
        rel = min(1.0, hits / target)
        total += (e.months / 12) * rel
    return round(min(total, resume.experience_years or total), 1)


def _experience_score(jd: JDProfile, total: float, relevant: float) -> tuple[float, str]:
    need = jd.min_years
    if not need:
        return 1.0, "The JD does not state a minimum experience, so experience is not penalised."
    ratio_total = min(1.0, total / need)
    ratio_rel = min(1.0, relevant / need)
    score = 0.5 * ratio_total + 0.5 * ratio_rel
    if total >= need and relevant >= need:
        note = f"Meets the {need:g}+ year requirement ({total:g} yrs total, {relevant:g} yrs relevant)."
    elif total >= need:
        note = (f"{total:g} yrs total clears the {need:g}-year bar, but only ~{relevant:g} yrs "
                f"are in work relevant to this role.")
    else:
        note = f"{total:g} yrs total (~{relevant:g} relevant) is below the {need:g}-year requirement."
    return score, note


def _education_score(jd: JDProfile, resume: ResumeProfile) -> tuple[float, str]:
    need, have = jd.education_level, resume.education_level
    if not need:
        return 1.0, "The JD does not require a specific degree."
    if have >= need:
        return 1.0, f"{LEVEL_LABEL[have]} meets the required {LEVEL_LABEL[need]}."
    if have == need - 1 and have > 0:
        return 0.6, f"{LEVEL_LABEL[have]} is one level below the required {LEVEL_LABEL[need]}."
    return 0.3, (f"No clear {LEVEL_LABEL[need]} found on the resume." if not have
                 else f"{LEVEL_LABEL[have]} is below the required {LEVEL_LABEL[need]}.")


def _semantic(jd_vecs: np.ndarray, jd_lines: list[str], resume: ResumeProfile, emb: Embedder):
    """Mean, over JD requirement lines, of the calibrated similarity to the best resume evidence line."""
    chunks = resume_chunks(resume)
    if not chunks or not len(jd_lines):
        return 0.0, [], 0.0
    r = emb.encode(chunks)
    sims = jd_vecs @ r.T                              # (jd_lines x resume_chunks)
    best_idx = sims.argmax(axis=1)
    best = sims.max(axis=1)
    per_line = np.array([emb.calibrate(float(x)) for x in best])
    evidence = []
    for i in np.argsort(-per_line)[:3]:
        evidence.append({"jd_line": jd_lines[i], "resume_line": chunks[int(best_idx[i])],
                         "similarity": round(float(per_line[i]) * 100)})
    return float(per_line.mean()), evidence, float(best.mean())


@dataclass
class MatchContext:
    jd: JDProfile
    emb: Embedder
    jd_lines: list[str]
    jd_vecs: np.ndarray


def prepare_jd(jd: JDProfile, emb: Embedder) -> MatchContext:
    lines = jd.chunks or [jd.text[:800]]
    vecs =emb.encode(lines) if lines else np.zeros((0, 1), dtype=np.float32)
    return MatchContext(jd, emb, lines, vecs)


def score_resume(ctx: MatchContext, resume: ResumeProfile) -> dict:
    jd, emb = ctx.jd, ctx.emb

    sk = _skill_scores(jd, resume, emb)
    sem, evidence, raw_cos = _semantic(ctx.jd_vecs, ctx.jd_lines, resume, emb)
    rel_years = _relevant_years(jd, resume)
    exp, exp_note = _experience_score(jd, resume.experience_years, rel_years)
    edu, edu_note = _education_score(jd, resume)

    weights = dict(WEIGHTS)
    skill_score = sk["score"]
    if skill_score is None:  # JD has no recognisable skills: shift that weight onto semantic similarity
        weights["semantic"] += weights.pop("skills")
        skill_score = 0.0
        weights["skills"] = 0.0

    parts = {"skills": skill_score, "semantic": sem, "experience": exp, "education": edu}
    total = 100 * sum(weights[k] * parts[k] for k in parts)
    total = round(max(0.0, min(100.0, total)), 1)

    rows = sk["rows"]
    matched = [r for r in rows if r["credit"] >= 0.8]
    partial = [r for r in rows if 0 < r["credit"] < 0.8]
    missing = [r for r in rows if r["credit"] == 0]
    req_rows = [r for r in rows if r["required"]]
    req_hit = [r for r in req_rows if r["credit"] >= 0.8]
    req_missing = [r["skill"] for r in req_rows if r["credit"] == 0]

    reasons: list[str] = []
    if req_rows:
        reasons.append(f"Covers {len(req_hit)} of {len(req_rows)} required skills in full"
                       + (f" and {len([r for r in req_rows if 0 < r['credit'] < 0.8])} partially" if any(0 < r['credit'] < 0.8 for r in req_rows) else "")
                       + ".")
    if req_missing:
        reasons.append("Missing required skills: " + ", ".join(req_missing[:8]) + ".")
    if partial:
        reasons.append("Partial credit: " + "; ".join(
            f"{r['skill']} via {r['via']} ({r['kind']}, {int(r['credit']*100)}%)" for r in partial[:5]) + ".")
    reasons.append(exp_note)
    level = "strong" if sem >= 0.7 else "moderate" if sem >= 0.4 else "weak"
    reasons.append(f"Semantic alignment between the resume's work history and the JD responsibilities is {level} "
                   f"({round(sem * 100)}%).")
    reasons.append(edu_note)

    contributions = {k: round(100 * weights[k] * parts[k], 1) for k in parts}
    return {
        "score": total,
        "label": label_for(total),
        "breakdown": {k: {"score": round(parts[k] * 100), "weight": round(weights[k] * 100),
                          "points": contributions[k]} for k in parts},
        "matched_skills": [{"skill": r["skill"], "required": r["required"], "kind": r["kind"], "via": r["via"],
                            "credit": r["credit"]} for r in matched],
        "partial_skills": [{"skill": r["skill"], "required": r["required"], "kind": r["kind"], "via": r["via"],
                            "credit": r["credit"]} for r in partial],
        "missing_skills": [{"skill": r["skill"], "required": r["required"]} for r in missing],
        "experience": {"candidate_years": resume.experience_years, "relevant_years": rel_years,
                       "required_years": jd.min_years, "source": resume.experience_source},
        "education": {"candidate": LEVEL_LABEL[resume.education_level], "required": LEVEL_LABEL[jd.education_level]},
        "evidence": evidence,
        "reasons": reasons,
    }
