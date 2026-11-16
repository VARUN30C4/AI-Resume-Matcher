import pytest


def _upload_resumes(client, job_id, paths):
    files = [("files", (p.name, p.read_bytes(), "application/octet-stream")) for p in paths]
    return client.post(f"/api/jobs/{job_id}/resumes", files=files)


def test_ranking_extended_fields(client, jd_text, resume_files):
    # 1. Create Job
    job = client.post("/api/jobs", data={"text": jd_text}).json()
    job_id = job["id"]

    # 2. Upload first 3 resumes
    r = _upload_resumes(client, job_id, resume_files[:3])
    assert r.status_code == 200
    ranking = r.json()["ranking"]
    assert len(ranking) == 3

    # Check each candidate has new extended fields
    for cand in ranking:
        assert "status" in cand
        assert cand["status"] in {"new", "shortlisted", "rejected"}
        assert "notes" in cand
        assert "components" in cand
        comp = cand["components"]
        assert set(comp.keys()) == {"skills", "semantic", "experience", "education"}
        for k, v in comp.items():
            assert 0.0 <= v <= 1.0
        assert "skills_detail" in cand
        detail = cand["skills_detail"]
        assert "matched" in detail and "partial" in detail and "missing" in detail


def test_candidate_patch_status_and_notes(client, jd_text, resume_files):
    job = client.post("/api/jobs", data={"text": jd_text}).json()
    job_id = job["id"]

    r = _upload_resumes(client, job_id, resume_files[:2])
    ranking = r.json()["ranking"]
    target = ranking[0]
    cid = target["id"]

    # 1. Update status to shortlisted
    res = client.patch(f"/api/jobs/{job_id}/candidates/{cid}", json={"status": "shortlisted", "notes": "Strong candidate for interview"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "shortlisted"
    assert body["notes"] == "Strong candidate for interview"

    # 2. Verify candidate detail endpoint returns updated values
    d = client.get(f"/api/jobs/{job_id}/candidates/{cid}").json()
    assert d["status"] == "shortlisted"
    assert d["notes"] == "Strong candidate for interview"

    # 3. Invalid status should return 400
    bad_res = client.patch(f"/api/jobs/{job_id}/candidates/{cid}", json={"status": "invalid_status"})
    assert bad_res.status_code == 400

    # 4. Update status to rejected
    res2 = client.patch(f"/api/jobs/{job_id}/candidates/{cid}", json={"status": "rejected"})
    assert res2.status_code == 200
    assert res2.json()["status"] == "rejected"
    # Notes should persist
    assert res2.json()["notes"] == "Strong candidate for interview"


def test_candidate_html_report(client, jd_text, resume_files):
    job = client.post("/api/jobs", data={"text": jd_text}).json()
    job_id = job["id"]

    _upload_resumes(client, job_id, resume_files[:1])
    ranking = client.get(f"/api/jobs/{job_id}/ranking").json()["ranking"]
    cid = ranking[0]["id"]

    # Request HTML report
    res = client.get(f"/api/jobs/{job_id}/candidates/{cid}/report.html")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    html = res.text
    assert "<!doctype html>" in html
    assert ranking[0]["name"] in html
    assert "Score Breakdown" in html
    assert "Experience Timeline" in html
