# AI Resume Matcher & Candidate Ranking System

An AI-powered recruitment engine that compares candidate resumes (PDF / DOCX) against a job description, computes explainable composite scores (0–100), extracts verifiable evidence, and provides deep recruiter decision-support analytics.

Built for the **AI-Based Resume Matching & Candidate Ranking** practical development assignment.

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 + Vite | SaaS dashboard styling, SVG visualizations, dark/light mode, keyboard navigation |
| **Backend** | Python 3.11+, FastAPI | REST API, async lifespan, Pydantic v2 validation |
| **NLP & Embeddings** | Sentence Transformers (`all-MiniLM-L6-v2`) | Dense semantic vectors with offline hash embedder fallback, ~110 skill taxonomy |
| **Database** | SQLite / PostgreSQL | SQLAlchemy 2.0 ORM with automated column migrations |
| **Document Parsing** | `pdfplumber` (PDF), `python-docx` (DOCX) | Layout-aware heading detection, date range deduplication |

---

## Quick Start

### 1. Backend Server
```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python ../scripts/generate_samples.py                  # Generates 12 synthetic resumes (6 PDF, 6 DOCX)
python -m pytest -q                                    # Runs 12 automated unit tests
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev                                            # http://localhost:5173 (proxies /api to :8000)
```

### 3. Single-Server Production Mode
Run `npm run build` inside `frontend/`, then run `uvicorn app.main:app --port 8000` inside `backend/`. FastAPI serves the compiled React app directly at **http://localhost:8000**.

> **Demo in 30 Seconds:**
> 1. Click **Load sample JD** → **Analyze Job Description**.
> 2. Drop all 12 files from `sample_data/resumes/` into the upload zone.
> 3. Click **Rank 12 Candidates**.
> 4. Click any candidate to inspect skill gaps, auto-generated interview questions, and semantic evidence!

---

## Assignment Functional Modules

| Module | Assignment Requirement | Implementation & File Mapping |
|---|---|---|
| **Module 1** | **Job Description Input:** Paste or upload JD; extract skills, experience, and degree requirements. | `parsing/jd_parser.py` + Collapsible Step 1 in `App.jsx`. Displays Required vs. Preferred skill chips and spec badges. |
| **Module 2** | **Resume Upload:** Batch upload 10+ resumes in PDF / DOCX; extract candidate details. | `parsing/extract_text.py`, `parsing/resume_parser.py` + Polished drop zone with format icons, file sizes, and parsing status in `App.jsx`. |
| **Module 3** | **AI Resume Matching:** Overall score (0–100), matched/missing skills, experience, semantic similarity beyond keywords. | `matching/scorer.py`, `nlp/embeddings.py`, `nlp/skills.py`. Evaluates exact, implied, related, and dense semantic alignment. |
| **Module 4** | **Candidate Ranking Dashboard:** Candidate, Experience, Match %, Matched Skills table with sorting/filtering. | `RankingTable.jsx`. Sticky header table, top-3 rank badges, circular score rings, expandable skills chips, and recruiter status filters. |
| **Module 5** | **Candidate-Level Analysis:** Extracted info, score breakdown, matched/missing skills, experience comparison, reasons. | `CandidateDrawer.jsx`. Tabbed drawer with SVG score ring, horizontal stacked component bar, skill gap analysis, and interview questions. |

---

## Scoring Methodology & Algorithm

```
Match % = 100 × ( 0.45 × Skills + 0.25 × Semantic + 0.20 × Experience + 0.10 × Education )
```

Each factor is evaluated as a normalized value from $0.0$ to $1.0$. The UI explains every point contributed so the score is 100% transparent.

### 1. Skills Coverage (45% Weight)
Skills are identified using alias-aware taxonomy regexes (`k8s` = `Kubernetes`, `Postgres` = `PostgreSQL`, `JS` is not `Java`). Mandatory JD requirements weigh **2×**, preferred skills weigh **1×**.
* **1.0 Credit:** Exact skill match or known alias (e.g. JD `Docker` $\rightarrow$ Resume `Docker`).
* **0.8 Credit:** Implied skill where candidate has a more specific specialization (e.g. JD `SQL` $\rightarrow$ Resume `PostgreSQL`; JD `NLP` $\rightarrow$ Resume `spaCy`).
* **0.5 Credit:** Related skill in the same architectural family (e.g. JD `FastAPI` $\rightarrow$ Resume `Flask`).
* **Up to 0.4 Credit:** High embedding semantic similarity.

### 2. Semantic Alignment (25% Weight)
Every JD requirement and responsibility line is transformed into a dense vector embedding via Sentence Transformers (`all-MiniLM-L6-v2`). Every bullet in the candidate's work history is embedded. For each JD line, the cosine similarity to the candidate's strongest matching bullet is calibrated (0.20 $\rightarrow$ 0.0, 0.65 $\rightarrow$ 1.0) and averaged across requirements. The 3 strongest semantic evidence pairs are shown in the drawer.

### 3. Experience Timeline (20% Weight)
Employment date ranges are parsed (`Mar 2021 – Present`, `2018 – 2020`), strictly restricted to the experience section. **Overlapping jobs are counted only once**. Relevant years weigh positions by how many required role skills were exercised.
$$\text{Experience} = \min\left(1.0, 0.5 \times \frac{\text{total}}{\text{required}} + 0.5 \times \frac{\text{relevant}}{\text{required}}\right)$$

### 4. Education Level (10% Weight)
* **1.0 Credit:** Highest degree meets or exceeds JD requirements (PhD > Master's > Bachelor's > Diploma).
* **0.6 Credit:** Highest degree is one tier below the required level.
* **0.3 Credit:** No target degree detected.

---

## Advanced Recruiter Features

### 1. Adjustable Scoring Weights
* Click **Adjust Weights** to open a slider drawer.
* Customize the weight of Skills, Semantic, Experience, and Education to match specialized roles (e.g., Skills-Heavy for junior developers, Experience-Heavy for tech leads).
* Coupled normalization ensures the total always equals 100%. Candidate scores and rankings re-sort **live in the browser** without re-running models.

### 2. Visual Analytics Dashboard
* **Skills Coverage Heatmap:** Interactive matrix with candidates as rows and JD skills as columns, color-coding exact matches (green), partial credit (amber), and missing skills (red).
* **Score Distribution Histogram:** Zero-dependency SVG bar chart grouping candidates into `<40%`, `40–59%`, `60–74%`, and `75–100%` tiers.
* **Component Composition Stacked Bars:** Comparative horizontal breakdown of points contributed by each factor per candidate.

### 3. Skill Gap Analysis & Auto-Generated Interview Questions
* For candidates scoring under 75%, highlights the exact point deficit and required skills missing.
* Generates targeted technical and behavioral interview questions tailored to each missing qualification without external LLM dependencies.

### 4. Recruiter Shortlist & Review Workflow
* One-click **Shortlist** (star) and **Reject** buttons directly on the ranking table and drawer.
* Status filter tabs: `All` | `Shortlisted` | `Unreviewed` | `Rejected`.
* Dedicated **Recruiter Notes** textarea saved to the database via `PATCH /api/jobs/{id}/candidates/{cid}`.

### 5. Must-Have Qualifications
* Click the star icon on any required skill chip in the JD summary to mark it as **Must-Have**.
* Candidates missing that skill are visually flagged with an alert chip without being dropped from the evaluation.

### 6. Command Palette & Keyboard Accessibility
* Press `Ctrl + K` (or `Cmd + K`) anywhere to open the **Command Palette** and jump to any candidate by name, skill, or status.
* Keyboard navigation: press `j` (next row), `k` (previous row), `Enter` (open drawer), `Esc` (close modal), and `?` for the keyboard shortcut guide.

### 7. Printable Candidate Dossier & CSV Export
* **Print Report:** Click *Print Report* in the drawer or navigate to `/api/jobs/{id}/candidates/{cid}/report.html` to open a clean, printable single-page dossier with `@media print` styling for PDF saving.
* **CSV Export:** One-click download of the candidate ranking table via `/api/jobs/{id}/export.csv`.

---

## Ethical AI & Bias Safeguards

The scoring engine is strictly deterministic and privacy-preserving:
* **Exempt Fields:** Candidate names, genders, ages, email domains, phone numbers, addresses, and photos are **never evaluated, tokenized, or factored into scoring**.
* **Evaluation Scope:** Scoring is restricted to technical skill tokens, verified employment dates, degree hierarchy, and semantic text alignment of work achievements.
* **Decision Support:** Scores and rankings are designed as screening aids for human recruiters to highlight evidence, not as an automated hiring decision.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/info` | Returns embedding backend, model name, and default weights |
| `GET` | `/api/sample-jd` | Returns bundled synthetic job description |
| `POST` | `/api/jobs` | Creates a new job from text or PDF/DOCX/TXT file |
| `GET` | `/api/jobs/{id}` | Retrieves job details and parsed requirements |
| `DELETE` | `/api/jobs/{id}` | Deletes job and associated candidates |
| `POST` | `/api/jobs/{id}/resumes` | Batch uploads and ranks up to 50 resumes |
| `GET` | `/api/jobs/{id}/ranking` | Retrieves ranked candidate list with per-component scores |
| `GET` | `/api/jobs/{id}/candidates/{cid}` | Retrieves candidate detail, score breakdown, and evidence |
| `PATCH` | `/api/jobs/{id}/candidates/{cid}` | Updates candidate review status (`new`/`shortlisted`/`rejected`) and notes |
| `GET` | `/api/jobs/{id}/candidates/{cid}/report.html` | Generates a standalone, print-optimized candidate dossier |
| `GET` | `/api/jobs/{id}/export.csv` | Downloads CSV export of ranking results |
| `DELETE` | `/api/jobs/{id}/candidates` | Clears all candidates for a job |

Interactive Swagger documentation is available at **http://localhost:8000/docs**.

---

## Automated Test Suite

Run the backend test suite:
```bash
cd backend
python -m pytest -q
```
**Test coverage (12 passing tests):**
* `test_parsing.py`: Alias matching, false-friend guards (`JavaScript` $\neq$ `Java`), overlapping experience deduplication, degree level scoring, OR-group alternative skills.
* `test_api.py`: End-to-end flow with 12 synthetic resumes, score breakdown validation, corrupt file isolation, and 404/validation checks.
* `test_advanced.py`: Extended ranking payloads, `PATCH` status and notes updates, HTML report generation, and SQLite schema migrations.

---

## Feature Demonstration Checklist

Use this checklist during technical demonstration:
- [x] **Step 1:** Click *Load sample JD* and *Analyze Job Description*. Review detected required vs preferred skills and spec badges.
- [x] **Step 1 (Must-Have):** Click the star on `Docker` in the required skills list to designate it as a Must-Have requirement.
- [x] **Step 2:** Drag and drop all 12 resumes from `sample_data/resumes/`. Observe file type badges and sizes.
- [x] **Step 2:** Click *Rank 12 Candidates*. Observe multi-phase progress tracker.
- [x] **Step 3:** Review ranked candidate table. Notice #1 Aarav Menon, #2 Meera Joshi, #3 Ananya Iyer with Gold/Silver/Bronze medals.
- [x] **Step 3 (Weights):** Click *Adjust Weights*, change to *Senior / Exp-Heavy* (30/15/45/10), and observe live score re-sorting and custom weights badge.
- [x] **Step 3 (Analytics):** Click *Visual Analytics* to inspect the Skills Coverage Heatmap, Score Distribution Histogram, and Component Stacked Bars.
- [x] **Step 3 (Compare):** Select Aarav Menon and Meera Joshi via checkboxes and click *Compare (2)* to view side-by-side strengths.
- [x] **Step 4 (Candidate Drawer):** Click on any candidate row. Inspect the SVG score ring, horizontal stacked breakdown, missing skill gaps, auto-generated interview questions, and recruiter notes.
- [x] **Step 4 (Shortlist & Dossier):** Star a candidate to add them to the Shortlist tab, and click *Print Report* to view the standalone printable dossier.
- [x] **Step 5 (Keyboard Shortcuts):** Press `Ctrl+K` to search via Command Palette, press `j`/`k` to move rows, and press `?` to view keyboard shortcuts.
