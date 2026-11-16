import { useEffect, useRef, useState, useMemo } from "react";
import {
  clearCandidates,
  createJob,
  exportUrl,
  getInfo,
  getSampleJd,
  uploadResumes,
  updateCandidate,
} from "./api.js";
import CandidateDrawer from "./CandidateDrawer.jsx";
import RankingTable from "./RankingTable.jsx";
import CompareModal from "./CompareModal.jsx";
import ScoreInfoModal from "./ScoreInfoModal.jsx";
import WeightsDrawer, { DEFAULT_WEIGHTS } from "./WeightsDrawer.jsx";
import AnalyticsView from "./AnalyticsView.jsx";
import CommandPalette from "./CommandPalette.jsx";
import ShortcutsModal from "./ShortcutsModal.jsx";
import GuidedTour from "./GuidedTour.jsx";
import { ToastContainer } from "./Toast.jsx";
import {
  UploadCloudIcon,
  FilePdfIcon,
  FileDocxIcon,
  FileIcon,
  CloseIcon,
  EditIcon,
  CheckCircleIcon,
  InfoIcon,
  DownloadIcon,
  TrashIcon,
  SparklesIcon,
  AlertCircleIcon,
  AwardIcon,
  StarIcon,
} from "./Icons.jsx";

const MIN_RECOMMENDED_RESUMES = 10;

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function App() {
  const [info, setInfo] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [job, setJob] = useState(null);
  const [isEditingJd, setIsEditingJd] = useState(false);
  const [files, setFiles] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [errors, setErrors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isWeightsOpen, setIsWeightsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [mustHaveSkills, setMustHaveSkills] = useState([]);
  const [lastClearedRanking, setLastClearedRanking] = useState(null);
  const [matchingPhase, setMatchingPhase] = useState("");
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);
  const [toasts, setToasts] = useState([]);
  const fileInput = useRef(null);

  // Fetch NLP engine info on mount
  useEffect(() => {
    getInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  // Global keyboard shortcuts (Ctrl+K for Command Palette, ? for shortcuts)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // ? for shortcuts cheat-sheet
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Toast notifications helper
  const addToast = (message, type = "info", action = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 6500 : 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Safe async runner
  const run = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      addToast(e.message || "An unexpected error occurred", "error");
    } finally {
      setBusy("");
    }
  };

  // Step 1: Analyze Job Description
  const analyzeJd = () =>
    run("jd", async () => {
      const created = await createJob({ text: jdText, file: jdFile });
      setJob(created);
      setIsEditingJd(false);
      setRanking([]);
      setErrors([]);
      setSelectedId(null);
      setCompareIds([]);
      setMustHaveSkills([]);
      if (jdFile && !jdText) setJdText(created.text);
      addToast("Job description analyzed successfully!", "success");
    });

  // Step 1: Load Sample JD
  const loadSample = () =>
    run("sample", async () => {
      const sample = await getSampleJd();
      setJdText(sample);
      setJdFile(null);
      setJob(null);
      setIsEditingJd(true);
      setRanking([]);
      setCompareIds([]);
      setMustHaveSkills([]);
      addToast("Sample Senior Python Engineer JD loaded.", "info");
    });

  // Toggle Must-Have Skill
  const toggleMustHaveSkill = (skill) => {
    setMustHaveSkills((prev) => {
      const isAlready = prev.includes(skill);
      const next = isAlready ? prev.filter((s) => s !== skill) : [...prev, skill];
      addToast(
        isAlready ? `Removed "${skill}" from Must-Have filter.` : `Marked "${skill}" as Must-Have qualification!`,
        "info"
      );
      return next;
    });
  };

  // Step 2: Add Resumes
  const addFiles = (list) => {
    const valid = [...list].filter((f) => /\.(pdf|docx)$/i.test(f.name));
    if (valid.length < list.length) {
      addToast("Some files were skipped. Only PDF and DOCX files are supported.", "error");
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const incoming = valid.filter((f) => !existing.has(f.name + f.size));
      if (incoming.length > 0) {
        addToast(`Added ${incoming.length} resume${incoming.length === 1 ? "" : "s"}.`, "info");
      }
      return [...prev, ...incoming];
    });
  };

  const removeFile = (fileToRemove) => {
    setFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  // Step 2: Rank Candidates with phased progress tracking
  const rank = () =>
    run("rank", async () => {
      setMatchingPhase("Extracting text and parsing employment timelines…");
      const phaseTimer1 = setTimeout(() => {
        setMatchingPhase("Matching skills taxonomy and evaluating degree alignment…");
      }, 700);
      const phaseTimer2 = setTimeout(() => {
        setMatchingPhase("Generating sentence embeddings and semantic alignment evidence…");
      }, 1500);

      try {
        const res = await uploadResumes(job.id, files);
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
        setRanking(res.ranking);
        setErrors(res.errors || []);
        setFiles([]);
        if (res.ranking?.length > 0) {
          addToast(`Successfully ranked ${res.ranking.length} candidates!`, "success");
        }
        if (res.errors?.length > 0) {
          addToast(`${res.errors.length} file(s) failed parsing.`, "error");
        }
      } finally {
        setMatchingPhase("");
      }
    });

  // Step 3: Clear Results with Undo Toast
  const reset = () =>
    run("clear", async () => {
      const backup = [...ranking];
      setLastClearedRanking(backup);
      await clearCandidates(job.id);
      setRanking([]);
      setErrors([]);
      setSelectedId(null);
      setCompareIds([]);

      addToast("Candidate rankings cleared.", "info", {
        label: "Undo",
        onClick: () => {
          setRanking(backup);
          addToast("Candidate rankings restored!", "success");
        },
      });
    });

  // Candidate comparison helpers
  const toggleCompare = (candidateId) => {
    setCompareIds((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId);
      }
      if (prev.length >= 3) {
        addToast("You can compare up to 3 candidates simultaneously.", "info");
        return prev;
      }
      return [...prev, candidateId];
    });
  };

  const removeCompareCandidate = (id) => {
    setCompareIds((prev) => prev.filter((cid) => cid !== id));
  };

  // Quick Shortlist / Toggle from Table
  const handleToggleShortlist = async (candidateId) => {
    const cand = ranking.find((c) => c.id === candidateId);
    if (!cand) return;
    const nextStatus = cand.status === "shortlisted" ? "new" : "shortlisted";
    try {
      const updated = await updateCandidate(job.id, candidateId, { status: nextStatus });
      handleCandidateUpdated(updated);
      addToast(
        nextStatus === "shortlisted"
          ? `${cand.name} added to shortlist!`
          : `${cand.name} removed from shortlist.`,
        "info"
      );
    } catch (e) {
      addToast(e.message || "Failed to update shortlist status", "error");
    }
  };

  // In-place Candidate Update Handler
  const handleCandidateUpdated = (updatedCandidate) => {
    setRanking((prev) =>
      prev.map((c) => (c.id === updatedCandidate.id ? { ...c, ...updatedCandidate } : c))
    );
  };

  // Stepper state determination
  const currentStep = useMemo(() => {
    if (ranking.length > 0) return 3;
    if (job) return 2;
    return 1;
  }, [job, ranking]);

  const candidateIdsList = useMemo(() => ranking.map((r) => r.id), [ranking]);
  const jd = job?.parsed;

  return (
    <div className="app-shell">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Guided Tour */}
      <GuidedTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        candidates={ranking}
        onSelectCandidate={(id) => setSelectedId(id)}
        onOpenWeights={() => setIsWeightsOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Keyboard Shortcuts Reference (?) */}
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Scoring Weights Drawer */}
      <WeightsDrawer
        isOpen={isWeightsOpen}
        onClose={() => setIsWeightsOpen(false)}
        weights={weights}
        onChangeWeights={setWeights}
        onResetWeights={() => {
          setWeights(DEFAULT_WEIGHTS);
          addToast("Weights reset to default (45/25/20/10)", "info");
        }}
      />

      {/* Score Calculation Explainer Modal */}
      <ScoreInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      {/* Side-by-Side Candidate Comparison Modal */}
      {isCompareOpen && (
        <CompareModal
          jobId={job?.id}
          candidateIds={compareIds}
          onClose={() => setIsCompareOpen(false)}
          onRemoveCandidate={removeCompareCandidate}
        />
      )}

      {/* Candidate Analysis Drawer */}
      {selectedId && job && (
        <CandidateDrawer
          jobId={job.id}
          id={selectedId}
          onClose={() => setSelectedId(null)}
          candidateIds={candidateIdsList}
          onNavigate={(newId) => setSelectedId(newId)}
          onNotify={addToast}
          onCandidateUpdated={handleCandidateUpdated}
        />
      )}

      {/* Header */}
      <header className="app-header no-print">
        <div className="header-brand-wrap">
          <div className="app-logo-badge">
            <SparklesIcon size={20} />
          </div>
          <div>
            <div className="app-title-row">
              <h1 className="app-title">AI Resume Matcher</h1>
              <span className="version-pill">v1.2 Pro</span>
            </div>
            <p className="app-tagline">
              Objective multi-factor candidate ranking using Sentence Transformers, skills taxonomy, and verifiable milestones.
            </p>
          </div>
        </div>

        <div className="header-meta-wrap">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Search candidates and quick actions (Ctrl+K)"
          >
            <span>Command Palette</span>
            <span className="kbd-pill">Ctrl+K</span>
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsTourOpen(true)}
            title="Start interactive product tour"
          >
            <span>Tour</span>
          </button>

          <button
            className="btn btn-secondary btn-sm info-explainer-btn"
            onClick={() => setIsInfoOpen(true)}
            title="Learn how Match % is calculated"
            aria-label="How scoring works"
          >
            <InfoIcon size={15} />
            <span>How scoring works</span>
          </button>

          {info && (
            <div
              className="nlp-engine-badge"
              title={`Embedding Model: ${info.embedding_model}`}
            >
              <span className="nlp-dot" />
              <span>
                {info.embedding_backend === "sentence-transformers"
                  ? "Sentence Transformers"
                  : "Offline Embedder"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Stepper Navigation */}
      <nav className="stepper-nav no-print" aria-label="Progress steps">
        <div
          className={`step-item ${currentStep === 1 ? "step-active" : currentStep > 1 ? "step-completed" : ""}`}
          onClick={() => job && setIsEditingJd(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && job && setIsEditingJd(true)}
        >
          <div className="step-circle">
            {job && !isEditingJd ? <CheckCircleIcon size={16} /> : "1"}
          </div>
          <div className="step-text">
            <span className="step-label">Step 1</span>
            <span className="step-title">Job Description</span>
          </div>
        </div>

        <div className="step-connector" />

        <div
          className={`step-item ${currentStep === 2 ? "step-active" : currentStep > 2 ? "step-completed" : ""} ${!job ? "step-disabled" : ""}`}
        >
          <div className="step-circle">
            {ranking.length > 0 ? <CheckCircleIcon size={16} /> : "2"}
          </div>
          <div className="step-text">
            <span className="step-label">Step 2</span>
            <span className="step-title">Upload Resumes</span>
          </div>
        </div>

        <div className="step-connector" />

        <div
          className={`step-item ${currentStep === 3 ? "step-active" : ""} ${ranking.length === 0 ? "step-disabled" : ""}`}
        >
          <div className="step-circle">3</div>
          <div className="step-text">
            <span className="step-label">Step 3</span>
            <span className="step-title">Ranking & Analysis</span>
          </div>
        </div>
      </nav>

      {/* ================= STEP 1: JOB DESCRIPTION ================= */}
      <section className="card step-card no-print" aria-labelledby="step-1-title">
        {/* Collapsed JD Summary when already analyzed and not editing */}
        {job && !isEditingJd ? (
          <div className="jd-collapsed-summary">
            <div className="jd-summary-header">
              <div className="jd-summary-meta">
                <span className="step-pill step-pill-success">
                  <CheckCircleIcon size={14} /> Step 1 Complete
                </span>
                <h2 id="step-1-title" className="jd-summary-title">
                  {jd?.title || "Target Role"}
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditingJd(true)}
                aria-label="Edit job description"
              >
                <EditIcon size={14} />
                <span>Edit JD</span>
              </button>
            </div>

            {/* Badges Row */}
            <div className="jd-badges-row">
              <span className="spec-badge">
                <strong>Min Experience:</strong>{" "}
                {jd?.min_years ? `${jd.min_years}+ years` : "Not specified"}
              </span>
              <span className="spec-badge">
                <strong>Education:</strong>{" "}
                {jd?.education_level ? jd.education_label : "Not specified"}
              </span>
              <span className="spec-badge">
                <strong>Required Skills:</strong> {jd?.required_skills?.length || 0}
              </span>
              <span className="spec-badge">
                <strong>Preferred Skills:</strong> {jd?.preferred_skills?.length || 0}
              </span>
            </div>

            {/* Grouped Skills Chips with Must-Have Toggles */}
            <div className="jd-skills-preview">
              <div className="skills-subgroup">
                <span className="skills-group-tag">Required (click ★ for Must-Have):</span>
                <div className="chips-wrap">
                  {jd?.required_skills?.length ? (
                    jd.required_skills.map((s) => {
                      const isMust = mustHaveSkills.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`chip chip-req ${isMust ? "chip-musthave-active" : ""}`}
                          onClick={() => toggleMustHaveSkill(s)}
                          title={isMust ? "Click to remove Must-Have flag" : "Click to mark as MUST-HAVE required skill"}
                        >
                          <StarIcon size={11} className={isMust ? "star-filled" : ""} />
                          <span>{s}</span>
                          {isMust && <span className="must-pill">MUST-HAVE</span>}
                        </button>
                      );
                    })
                  ) : (
                    <span className="muted small">None detected</span>
                  )}
                </div>
              </div>

              {jd?.preferred_skills?.length > 0 && (
                <div className="skills-subgroup">
                  <span className="skills-group-tag">Preferred:</span>
                  <div className="chips-wrap">
                    {jd.preferred_skills.map((s) => (
                      <span key={s} className="chip chip-pref">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Expanded JD Editor */
          <div className="jd-editor">
            <div className="step-card-header">
              <div className="step-title-group">
                <span className="step-number-badge">1</span>
                <div>
                  <h2 id="step-1-title" className="step-card-title">
                    Target Job Description
                  </h2>
                  <p className="step-card-desc">
                    Paste the job description or upload a document. The parser extracts required skills, experience thresholds, and responsibilities.
                  </p>
                </div>
              </div>
              {job && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsEditingJd(false)}
                >
                  Cancel editing
                </button>
              )}
            </div>

            <div className="textarea-container">
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  setJob(null);
                }}
                placeholder="Paste the target job description here (e.g. responsibilities, required qualifications, tech stack)…"
                rows={8}
                className="jd-textarea"
                aria-label="Job description input text"
              />
              {!jdText && !jdFile && (
                <div className="textarea-empty-hint">
                  <InfoIcon size={14} />
                  <span>
                    Need a test example? Click <strong>Load sample JD</strong> below to load a Senior Python role.
                  </span>
                </div>
              )}
            </div>

            <div className="card-actions-row">
              <button
                className="btn btn-primary"
                onClick={analyzeJd}
                disabled={busy || (!jdText.trim() && !jdFile)}
              >
                {busy === "jd" ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Analyzing JD…</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon size={16} />
                    <span>Analyze Job Description</span>
                  </>
                )}
              </button>

              <label className="btn btn-secondary file-upload-btn">
                <span>Upload JD Document</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files[0] || null;
                    setJdFile(f);
                    setJob(null);
                    if (f) addToast(`Selected JD file: ${f.name}`, "info");
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                className="btn btn-ghost"
                onClick={loadSample}
                disabled={!!busy}
              >
                Load sample JD
              </button>

              {jdFile && (
                <span className="file-selected-badge">
                  <FileIcon size={14} />
                  <span>{jdFile.name} ({formatFileSize(jdFile.size)})</span>
                  <button
                    className="chip-remove"
                    onClick={() => setJdFile(null)}
                    aria-label="Remove selected file"
                  >
                    <CloseIcon size={12} />
                  </button>
                </span>
              )}
            </div>

            {/* Loading Skeleton */}
            {busy === "jd" && (
              <div className="jd-skeleton-loader" aria-live="polite">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-subtitle" />
                <div className="skeleton-chips-row">
                  <div className="skeleton skeleton-chip" />
                  <div className="skeleton skeleton-chip" />
                  <div className="skeleton skeleton-chip" />
                  <div className="skeleton skeleton-chip" />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================= STEP 2: RESUMES BATCH ================= */}
      <section
        className={`card step-card no-print ${!job ? "card-disabled" : ""}`}
        aria-labelledby="step-2-title"
      >
        <div className="step-card-header">
          <div className="step-title-group">
            <span className="step-number-badge">2</span>
            <div>
              <h2 id="step-2-title" className="step-card-title">
                Candidate Resumes
              </h2>
              <p className="step-card-desc">
                Batch upload PDF or DOCX resumes. All documents are parsed and cross-evaluated in memory.
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <span className="badge badge-accent">
              {files.length} resume{files.length === 1 ? "" : "s"} ready
            </span>
          )}
        </div>

        {/* Polished Drag & Drop Zone */}
        <div
          className={`dropzone ${drag ? "dropzone-over" : ""} ${!job ? "dropzone-locked" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (job) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (job) addFiles(e.dataTransfer.files);
          }}
          onClick={() => job && fileInput.current?.click()}
          role="button"
          tabIndex={job ? 0 : -1}
          onKeyDown={(e) => e.key === "Enter" && job && fileInput.current?.click()}
          aria-label="Upload candidate resumes"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="dropzone-icon-wrap">
            <UploadCloudIcon size={36} />
          </div>

          <div className="dropzone-content">
            <strong className="dropzone-title">
              Drop resumes here or click to browse
            </strong>
            <p className="dropzone-sub muted small">
              Supports PDF and DOCX · Up to 50 files · Max 10 MB per file
            </p>
          </div>

          <div className="dropzone-formats">
            <span className="format-pill">
              <FilePdfIcon size={14} /> PDF
            </span>
            <span className="format-pill">
              <FileDocxIcon size={14} /> DOCX
            </span>
          </div>
        </div>

        {!job && (
          <div className="step-lock-notice">
            <InfoIcon size={14} />
            <span>Complete Step 1 (Analyze Job Description) first to unlock resume matching.</span>
          </div>
        )}

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="selected-files-section">
            <div className="files-section-header">
              <span className="files-count-text">
                Selected Resumes (<strong>{files.length}</strong>)
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFiles([])}
                disabled={!!busy}
              >
                Clear all
              </button>
            </div>

            <ul className="files-list" role="list">
              {files.map((f) => {
                const isPdf = /\.pdf$/i.test(f.name);
                return (
                  <li key={f.name + f.size} className="file-list-item">
                    <div className="file-item-left">
                      {isPdf ? <FilePdfIcon size={18} /> : <FileDocxIcon size={18} />}
                      <span className="file-item-name" title={f.name}>
                        {f.name}
                      </span>
                      <span className="file-item-size muted small">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                    <button
                      className="file-remove-btn"
                      onClick={() => removeFile(f)}
                      aria-label={`Remove ${f.name}`}
                      title="Remove file"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Matching In-Progress State */}
            {busy === "rank" && (
              <div className="matching-progress-box" role="status" aria-live="polite">
                <div className="progress-info-row">
                  <span className="progress-msg">
                    {matchingPhase || "Extracting text, analyzing skills and calculating sentence embeddings…"}
                  </span>
                  <span className="progress-spinner" />
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-animated" />
                </div>
              </div>
            )}

            <div className="card-actions-row">
              <button
                className="btn btn-primary"
                onClick={rank}
                disabled={!!busy || files.length === 0}
              >
                {busy === "rank" ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Matching {files.length} Candidates…</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon size={16} />
                    <span>
                      Rank {files.length} Candidate{files.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </button>

              {files.length < MIN_RECOMMENDED_RESUMES && (
                <span className="batch-recommendation muted small">
                  Tip: Batches of 10+ resumes provide the best distribution for comparative ranking.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Failed Parsing Errors List */}
        {errors.length > 0 && (
          <div className="alert alert-warn" role="alert">
            <div className="alert-warn-header">
              <AlertCircleIcon size={18} />
              <strong>{errors.length} file(s) could not be parsed:</strong>
            </div>
            <ul className="alert-error-list">
              {errors.map((errItem) => (
                <li key={errItem.filename}>
                  <strong>{errItem.filename}:</strong> {errItem.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ================= STEP 3: CANDIDATE RANKING ================= */}
      {ranking.length > 0 && (
        <section className="card step-card no-print" aria-labelledby="step-3-title">
          <div className="step-card-header between">
            <div className="step-title-group">
              <span className="step-number-badge">3</span>
              <div>
                <h2 id="step-3-title" className="step-card-title">
                  Candidate Ranking & Evaluation
                </h2>
                <p className="step-card-desc">
                  Ranked by composite match score. Click any row to inspect deep evidence, skills alignment, and work history.
                </p>
              </div>
            </div>

            <div className="ranking-actions-group">
              <a
                className="btn btn-secondary btn-sm"
                href={exportUrl(job.id)}
                download
                title="Download CSV export of rankings"
              >
                <DownloadIcon size={14} />
                <span>Export CSV</span>
              </a>
              <button
                className="btn btn-ghost btn-sm"
                onClick={reset}
                disabled={!!busy}
                title="Clear current candidate rankings"
              >
                <TrashIcon size={14} />
                <span>Clear results</span>
              </button>
            </div>
          </div>

          {/* Optional Visual Analytics View */}
          {isAnalyticsOpen && (
            <AnalyticsView
              candidates={ranking}
              job={job}
              onSelectCandidate={(id) => setSelectedId(id)}
            />
          )}

          <RankingTable
            rows={ranking}
            onSelect={setSelectedId}
            selectedId={selectedId}
            job={job}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            onOpenCompare={() => setIsCompareOpen(true)}
            weights={weights}
            onOpenWeights={() => setIsWeightsOpen(true)}
            mustHaveSkills={mustHaveSkills}
            onToggleShortlist={handleToggleShortlist}
            isAnalyticsOpen={isAnalyticsOpen}
            onToggleAnalytics={() => setIsAnalyticsOpen((prev) => !prev)}
          />
        </section>
      )}

      {/* Footer Note */}
      <footer className="app-footer no-print">
        <div className="footer-disclaimer">
          <InfoIcon size={15} />
          <span>
            <strong>Screening Decision Support & Bias Safeguards:</strong> AI Resume Matcher evaluates candidates strictly on verified career dates, degree hierarchy, technical skills taxonomy, and semantic text alignment. Demographic variables (name, gender, age, email domain, phone, address, and photos) are never evaluated. Rankings should inform human review and interview decisions, not serve as an automated hiring determinant.
          </span>
        </div>
      </footer>
    </div>
  );
}
