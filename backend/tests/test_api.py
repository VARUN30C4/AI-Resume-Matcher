import io


def _upload(client, job_id, paths):
    files = [("files", (p.name, p.read_bytes(), "application/octet-stream")) for p in paths]
    return client.post(f"/api/jobs/{job_id}/resumes", files=files)


def test_full_flow(client, jd_text, resume_files):
    r = client.post("/api/jobs", data={"text": jd_text})
    assert r.status_code == 200
    job = r.json()
    assert job["parsed"]["min_years"] == 3.0

    r = _upload(client, job["id"], resume_files)
    assert r.status_code == 200
    body = r.json()
    assert len(body["added"]) == len(resume_files) and body["errors"] == []

    ranking = body["ranking"]
    scores = [x["score"] for x in ranking]
    assert scores == sorted(scores, reverse=True)                  # ranked best-first
    assert all(0 <= s <= 100 for s in scores)
    names = [x["name"] for x in ranking]
    assert names[0] in {"Aarav Menon", "Meera Joshi"}              # strongest backend + NLP profiles
    assert names.index("Aarav Menon") < names.index("Vikram Singh")  # JS dev ranks below the Python/NLP dev
    assert names.index("Priya Nair") < names.index("Dev Patel")

    # candidate detail (Module 5)
    top = ranking[0]
    d = client.get(f"/api/jobs/{job['id']}/candidates/{top['id']}").json()
    res = d["result"]
    assert d["profile"]["email"].endswith("@example.com")
    assert res["matched_skills"] and "reasons" in res and res["reasons"]
    assert set(res["breakdown"]) == {"skills", "semantic", "experience", "education"}
    assert abs(sum(b["points"] for b in res["breakdown"].values()) - res["score"]) < 0.3   # score is fully explained

    assert client.get(f"/api/jobs/{job['id']}/export.csv").text.startswith("Rank,Candidate")


def test_bad_files_do_not_break_the_batch(client, jd_text, resume_files):
    job = client.post("/api/jobs", data={"text": jd_text}).json()
    files = [
        ("files", ("notes.exe", b"MZ....", "application/octet-stream")),
        ("files", ("empty.pdf", b"", "application/pdf")),
        ("files", ("broken.pdf", b"%PDF-1.4 not really a pdf", "application/pdf")),
        ("files", (resume_files[0].name, resume_files[0].read_bytes(), "application/octet-stream")),
    ]
    body = client.post(f"/api/jobs/{job['id']}/resumes", files=files).json()
    assert len(body["added"]) == 1
    assert {e["filename"] for e in body["errors"]} == {"notes.exe", "empty.pdf", "broken.pdf"}


def test_validation_and_404(client):
    assert client.post("/api/jobs", data={"text": "too short"}).status_code == 400
    assert client.get("/api/jobs/999999").status_code == 404
    assert client.get("/api/info").json()["embedding_backend"] in {"offline", "sentence-transformers"}
