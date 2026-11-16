import React, { useEffect, useState, useMemo } from "react";
import { getCandidate, updateCandidate, candidateReportUrl } from "./api.js";
import { ScoreBar, tone } from "./RankingTable.jsx";
import { getInterviewQuestionsForSkill } from "./interviewTemplates.js";
import {
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  StarIcon,
  AwardIcon,
  InfoIcon,
  DownloadIcon,
  EditIcon,
} from "./Icons.jsx";

const PARTS = {
  skills: { label: "Skills Coverage", maxWeight: 45, colorClass: "part-skills" },
  semantic: { label: "Semantic Similarity", maxWeight: 25, colorClass: "part-semantic" },
  experience: { label: "Experience Timeline", maxWeight: 20, colorClass: "part-exp" },
  education: { label: "Education Level", maxWeight: 10, colorClass: "part-edu" },
};

const KIND_LABELS = {
  exact: "Exact match",
  implied: "Implied by specific skill",
  related: "Related skill",
  semantic: "Embedding similarity",
};

export function ScoreRingLarge({ value, size = 96, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const t = tone(value);
  const strokeDashoffset = circumference - (Math.max(2, Math.min(100, value)) / 100) * circumference;

  return (
    <div className={`score-ring-large score-${t}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="ring-content">
        <span className="ring-value">{Math.round(value)}</span>
        <span className="ring-unit">%</span>
      </div>
    </div>
  );
}

export default function CandidateDrawer({
  jobId,
  id,
  onClose,
  candidateIds = [],
  onNavigate,
  onNotify = () => {},
  onCandidateUpdated = () => {},
}) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Recruiter notes and status state
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAlert, setNotesSavedAlert] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErr("");
    getCandidate(jobId, id)
      .then((data) => {
        setD(data);
        setStatus(data.status || "new");
        setNotes(data.notes || "");
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message || "Failed to load candidate details");
        setLoading(false);
      });
  }, [jobId, id]);

  // Keyboard navigation & Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && prevId && onNavigate) {
        onNavigate(prevId);
      } else if (e.key === "ArrowRight" && nextId && onNavigate) {
        onNavigate(nextId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, id, candidateIds]);

  // Compute Prev / Next candidate IDs
  const { prevId, nextId, currentIndex, totalCount } = useMemo(() => {
    if (!candidateIds || candidateIds.length === 0) {
      return { prevId: null, nextId: null, currentIndex: -1, totalCount: 0 };
    }
    const idx = candidateIds.indexOf(id);
    return {
      prevId: idx > 0 ? candidateIds[idx - 1] : null,
      nextId: idx >= 0 && idx < candidateIds.length - 1 ? candidateIds[idx + 1] : null,
      currentIndex: idx,
      totalCount: candidateIds.length,
    };
  }, [candidateIds, id]);

  const p = d?.profile;
  const r = d?.result;
  const exp = r?.experience;
  const maxYears = exp ? Math.max(exp.candidate_years || 0, exp.required_years || 0, 1) : 1;

  // Handle Shortlist / Reject toggle
  const handleStatusChange = async (newStatus) => {
    try {
      const nextVal = status === newStatus ? "new" : newStatus;
      setStatus(nextVal);
      const res = await updateCandidate(jobId, id, { status: nextVal });
      onCandidateUpdated(res);
      onNotify(
        nextVal === "shortlisted"
          ? `${p.name} added to shortlist!`
          : nextVal === "rejected"
          ? `${p.name} marked as rejected.`
          : `${p.name} status reset to new.`,
        "info"
      );
    } catch (e) {
      onNotify(e.message || "Failed to update status", "error");
    }
  };

  // Handle Save Recruiter Notes
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await updateCandidate(jobId, id, { notes });
      onCandidateUpdated(res);
      setNotesSavedAlert(true);
      setTimeout(() => setNotesSavedAlert(false), 2500);
      onNotify("Recruiter notes saved.", "success");
    } catch (e) {
      onNotify(e.message || "Failed to save notes", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  // Missing required skills list sorted by potential credit impact
  const missingRequired = useMemo(() => {
    if (!r?.missing_skills) return [];
    return r.missing_skills.filter((s) => s.required);
  }, [r]);

  // Copy Summary Action
  const copySummary = () => {
    if (!d || !p || !r) return;
    const summaryText = [
      `# Candidate: ${p.name} (Rank #${d.rank})`,
      `Role: ${p.current_title || d.filename} | Match: ${Math.round(r.score)}% (${r.label}) | Status: ${status.toUpperCase()}`,
      ``,
      `## Score Breakdown (Total: ${r.score}/100 pts)`,
      `- Skills (45%): ${r.breakdown.skills.points} pts (${r.breakdown.skills.score}% coverage)`,
      `- Semantic (25%): ${r.breakdown.semantic.points} pts (${r.breakdown.semantic.score}% similarity)`,
      `- Experience (20%): ${r.breakdown.experience.points} pts`,
      `- Education (10%): ${r.breakdown.education.points} pts`,
      ``,
      `## Experience & Education`,
      `- Experience: ${exp.candidate_years} yrs total (${exp.relevant_years} yrs relevant) vs ${exp.required_years || "none"} required`,
      `- Education: ${r.education.candidate || "Not detected"} (JD: ${r.education.required || "Not specified"})`,
      ``,
      `## Skills Match`,
      `- Matched (${r.matched_skills.length}): ${r.matched_skills.map((s) => s.skill).join(", ") || "None"}`,
      `- Partial (${r.partial_skills.length}): ${r.partial_skills.map((s) => `${s.skill} via ${s.via}`).join(", ") || "None"}`,
      `- Missing (${r.missing_skills.length}): ${r.missing_skills.map((s) => `${s.skill}${s.required ? " (REQUIRED)" : ""}`).join(", ") || "None"}`,
      ``,
      notes ? `## Recruiter Notes\n${notes}\n` : "",
      `## Key Assessment Notes`,
      ...r.reasons.map((note) => `- ${note}`),
    ].join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summaryText).then(
        () => onNotify(`Summary for ${p.name} copied to clipboard!`, "success"),
        () => onNotify("Could not access clipboard", "error")
      );
    } else {
      onNotify("Clipboard not supported in this browser", "error");
    }
  };

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside
        className="candidate-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-candidate-name"
      >
        {/* Drawer Sticky Top Action Bar */}
        <div className="drawer-top-bar">
          <div className="drawer-nav-group">
            <button
              className="btn btn-ghost btn-sm nav-btn"
              onClick={() => prevId && onNavigate && onNavigate(prevId)}
              disabled={!prevId}
              aria-label="Previous candidate"
              title="Previous candidate (Left arrow)"
            >
              <ChevronLeftIcon size={16} />
              <span>Prev</span>
            </button>
            <span className="drawer-counter-badge muted small">
              {currentIndex >= 0 ? `${currentIndex + 1} of ${totalCount}` : ""}
            </span>
            <button
              className="btn btn-ghost btn-sm nav-btn"
              onClick={() => nextId && onNavigate && onNavigate(nextId)}
              disabled={!nextId}
              aria-label="Next candidate"
              title="Next candidate (Right arrow)"
            >
              <span>Next</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>

          <div className="drawer-top-actions">
            {d && (
              <>
                {/* Shortlist Action */}
                <button
                  className={`btn btn-sm ${status === "shortlisted" ? "btn-shortlist-active" : "btn-secondary"}`}
                  onClick={() => handleStatusChange("shortlisted")}
                  title={status === "shortlisted" ? "Remove from shortlist" : "Star / Shortlist candidate"}
                  aria-label="Shortlist candidate"
                >
                  <StarIcon size={14} className={status === "shortlisted" ? "star-filled" : ""} />
                  <span>{status === "shortlisted" ? "Shortlisted" : "Shortlist"}</span>
                </button>

                {/* Reject Action */}
                <button
                  className={`btn btn-sm ${status === "rejected" ? "btn-reject-active" : "btn-ghost"}`}
                  onClick={() => handleStatusChange("rejected")}
                  title={status === "rejected" ? "Unmark rejection" : "Mark as rejected"}
                  aria-label="Reject candidate"
                >
                  <CloseIcon size={14} />
                  <span>{status === "rejected" ? "Rejected" : "Reject"}</span>
                </button>

                {/* Print Report */}
                <a
                  className="btn btn-secondary btn-sm"
                  href={candidateReportUrl(jobId, id)}
                  target="_blank"
                  rel="noreferrer"
                  title="Open printable HTML candidate dossier"
                >
                  <DownloadIcon size={14} />
                  <span>Print Report</span>
                </a>

                {/* Copy Summary */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={copySummary}
                  title="Copy candidate summary to clipboard"
                  aria-label="Copy summary"
                >
                  <CopyIcon size={14} />
                  <span>Copy</span>
                </button>
              </>
            )}
            <button
              className="drawer-close-btn"
              onClick={onClose}
              aria-label="Close drawer (Escape)"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Loading and Error States */}
        {loading && (
          <div className="drawer-body-loading">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-subtitle" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        )}

        {err && (
          <div className="alert alert-error" role="alert">
            <AlertCircleIcon size={18} />
            <span>{err}</span>
          </div>
        )}

        {/* Candidate Content */}
        {!loading && !err && d && (
          <div className="drawer-content-scroll">
            {/* Candidate Header */}
            <div className="drawer-header-card">
              <div className="dhead-left">
                <div className="dhead-rank-row">
                  <span className="dhead-rank-pill">Rank #{d.rank}</span>
                  {status === "shortlisted" && (
                    <span className="status-badge-shortlisted">
                      <StarIcon size={12} /> Shortlisted
                    </span>
                  )}
                  {status === "rejected" && (
                    <span className="status-badge-rejected">Rejected</span>
                  )}
                </div>
                <h2 id="drawer-candidate-name" className="candidate-drawer-name">
                  {p.name}
                </h2>
                <div className="candidate-drawer-role muted">
                  {p.current_title || d.filename}
                </div>
                <div className={`drawer-tier-pill tier-${tone(r.score)}`}>
                  {r.label}
                </div>
              </div>
              <div className="dhead-right">
                <ScoreRingLarge value={r.score} />
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="drawer-tabs" role="tablist" aria-label="Candidate details sections">
              <button
                className={`drawer-tab ${activeTab === "overview" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`drawer-tab ${activeTab === "skills" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "skills"}
                onClick={() => setActiveTab("skills")}
              >
                Skills & Gaps ({r.matched_skills.length + r.partial_skills.length})
              </button>
              <button
                className={`drawer-tab ${activeTab === "interview" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "interview"}
                onClick={() => setActiveTab("interview")}
              >
                Interview Prep ({missingRequired.length})
              </button>
              <button
                className={`drawer-tab ${activeTab === "experience" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "experience"}
                onClick={() => setActiveTab("experience")}
              >
                Experience & Edu
              </button>
              <button
                className={`drawer-tab ${activeTab === "evidence" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "evidence"}
                onClick={() => setActiveTab("evidence")}
              >
                Evidence ({r.evidence?.length || 0})
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="tab-pane" role="tabpanel">
                {/* Horizontal Stacked Bar */}
                <div className="stacked-breakdown-card">
                  <div className="section-title-row">
                    <h3 className="section-title">Score Composition</h3>
                    <span className="total-score-badge">
                      <strong>{r.score}</strong> / 100 points
                    </span>
                  </div>

                  <div
                    className="stacked-bar-container"
                    role="progressbar"
                    aria-valuenow={r.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Composite score breakdown"
                  >
                    <div
                      className="stacked-segment segment-skills"
                      style={{ width: `${(r.breakdown.skills.points / 100) * 100}%` }}
                      title={`Skills: ${r.breakdown.skills.points} pts (${r.breakdown.skills.score}% coverage)`}
                    />
                    <div
                      className="stacked-segment segment-semantic"
                      style={{ width: `${(r.breakdown.semantic.points / 100) * 100}%` }}
                      title={`Semantic: ${r.breakdown.semantic.points} pts (${r.breakdown.semantic.score}% similarity)`}
                    />
                    <div
                      className="stacked-segment segment-exp"
                      style={{ width: `${(r.breakdown.experience.points / 100) * 100}%` }}
                      title={`Experience: ${r.breakdown.experience.points} pts`}
                    />
                    <div
                      className="stacked-segment segment-edu"
                      style={{ width: `${(r.breakdown.education.points / 100) * 100}%` }}
                      title={`Education: ${r.breakdown.education.points} pts`}
                    />
                  </div>

                  {/* Component Breakdown Rows */}
                  <div className="component-legend-grid">
                    {Object.entries(r.breakdown).map(([key, item]) => {
                      const meta = PARTS[key] || { label: key, maxWeight: 0, colorClass: "" };
                      return (
                        <div key={key} className="component-legend-item">
                          <div className="comp-item-header">
                            <span className={`comp-color-dot dot-${key}`} />
                            <span className="comp-name">{meta.label}</span>
                            <span className="comp-weight muted small">({item.weight}%)</span>
                          </div>
                          <div className="comp-points-row">
                            <span className="comp-pts">
                              <strong>{item.points}</strong> pts
                            </span>
                            <span className="comp-calc muted small">
                              {item.score}% of {item.weight}
                            </span>
                          </div>
                          <ScoreBar value={item.score} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recruiter Notes Editor */}
                <div className="drawer-notes-card">
                  <div className="section-title-row">
                    <h3 className="section-title">Recruiter Notes</h3>
                    {notesSavedAlert && <span className="saved-confirm-pill">Saved!</span>}
                  </div>
                  <textarea
                    className="notes-textarea"
                    rows={3}
                    placeholder="Add interview notes, impressions, or screening thoughts for this candidate…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="notes-actions-row">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? "Saving…" : "Save Note"}
                    </button>
                    <span className="muted small">Saved to database for cross-team review.</span>
                  </div>
                </div>

                {/* Extracted Contact & Profile Info */}
                <div className="drawer-info-card">
                  <h3 className="section-title">Candidate Profile</h3>
                  <dl className="candidate-info-dl">
                    <dt>Email</dt>
                    <dd>{p.email || "—"}</dd>

                    <dt>Phone</dt>
                    <dd>{p.phone || "—"}</dd>

                    <dt>Links</dt>
                    <dd>
                      {p.links?.length > 0 ? (
                        p.links.map((link, idx) => (
                          <span key={idx} className="link-item">
                            <a
                              href={link.startsWith("http") ? link : `https://${link}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {link}
                            </a>
                            {idx < p.links.length - 1 ? " · " : ""}
                          </span>
                        ))
                      ) : (
                        "—"
                      )}
                    </dd>

                    <dt>Education</dt>
                    <dd>{p.education?.length ? p.education.join(" · ") : "—"}</dd>

                    <dt>Experience</dt>
                    <dd>
                      {p.experience_years} years total ({p.experience_source === "dates" ? "calculated from employment dates" : p.experience_source === "stated" ? "as stated on resume" : "not specified"})
                    </dd>

                    {p.certifications?.length > 0 && (
                      <>
                        <dt>Certifications</dt>
                        <dd>{p.certifications.join(" · ")}</dd>
                      </>
                    )}
                  </dl>
                </div>

                {/* Assessment Reasons */}
                <div className="drawer-reasons-card">
                  <h3 className="section-title">Assessment Summary</h3>
                  <ul className="reasons-list">
                    {r.reasons.map((note, idx) => (
                      <li key={idx} className="reason-item">
                        <CheckCircleIcon size={16} className="reason-icon" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bias Safeguards Callout */}
                <div className="bias-safeguard-note">
                  <InfoIcon size={14} />
                  <span>
                    <strong>Bias Safeguard:</strong> This evaluation factors strictly technical skills, verified employment timeline, degree level, and semantic text alignment. Demographic variables (name, gender, age, email domain, phone, address, photo) are never evaluated.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: SKILLS & GAPS */}
            {activeTab === "skills" && (
              <div className="tab-pane" role="tabpanel">
                {/* Skill Gap Alert Card */}
                {r.score < 75 ? (
                  <div className="skill-gap-alert-card">
                    <div className="gap-alert-head">
                      <AlertCircleIcon size={18} className="gap-alert-icon" />
                      <div>
                        <strong>To Reach Strong Match (≥75%):</strong>
                        <div className="gap-alert-sub muted small">
                          Candidate is currently {Math.round(r.score)}% (needs +{(75 - r.score).toFixed(1)} points). Focus on these missing required skills:
                        </div>
                      </div>
                    </div>
                    <div className="gap-skills-list">
                      {missingRequired.length > 0 ? (
                        missingRequired.map((s) => (
                          <div key={s.skill} className="gap-skill-item">
                            <span className="chip chip-reqmiss">{s.skill}</span>
                            <span className="gap-impact muted small">Weight: 2× in skills module</span>
                          </div>
                        ))
                      ) : (
                        <p className="muted small">All required skills are met; gap is in semantic depth or experience tenure.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="skill-gap-cleared-card">
                    <CheckCircleIcon size={18} className="gap-cleared-icon" />
                    <div>
                      <strong>Strong Match Cleared!</strong>
                      <div className="gap-cleared-sub muted small">
                        This candidate satisfies the ≥75% benchmark with high taxonomy coverage.
                      </div>
                    </div>
                  </div>
                )}

                {/* Fully Matched Skills */}
                <div className="skills-group-card">
                  <div className="skills-group-header">
                    <div className="skills-group-title">
                      <span className="dot-ok" />
                      <strong>Fully Matched Skills ({r.matched_skills.length})</strong>
                    </div>
                    <span className="muted small">1.0 / 0.8 credit earned</span>
                  </div>
                  <div className="chips-wrap">
                    {r.matched_skills.length > 0 ? (
                      r.matched_skills.map((s) => (
                        <span key={s.skill} className="chip chip-ok" title={KIND_LABELS[s.kind] || s.kind}>
                          <CheckCircleIcon size={12} />
                          <span>{s.skill}</span>
                          {s.via && s.via !== s.skill && (
                            <em className="via-text"> (via {s.via})</em>
                          )}
                          {s.required && <span className="req-tag">Required</span>}
                        </span>
                      ))
                    ) : (
                      <p className="muted small">No fully matched skills found.</p>
                    )}
                  </div>
                </div>

                {/* Partial Credit Skills */}
                <div className="skills-group-card">
                  <div className="skills-group-header">
                    <div className="skills-group-title">
                      <span className="dot-partial" />
                      <strong>Partial Credit Skills ({r.partial_skills.length})</strong>
                    </div>
                    <span className="muted small">Related or semantic match</span>
                  </div>
                  <div className="chips-wrap">
                    {r.partial_skills.length > 0 ? (
                      r.partial_skills.map((s) => (
                        <span
                          key={s.skill}
                          className="chip chip-partial"
                          title={`${KIND_LABELS[s.kind] || s.kind}: Credit ${Math.round(s.credit * 100)}%`}
                        >
                          <span>{s.skill}</span>
                          {s.via && s.via !== s.skill && (
                            <em className="via-text"> (via {s.via})</em>
                          )}
                          <span className="credit-tag">{Math.round(s.credit * 100)}% credit</span>
                          {s.required && <span className="req-tag">Required</span>}
                        </span>
                      ))
                    ) : (
                      <p className="muted small">No partial credit skills.</p>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="skills-group-card">
                  <div className="skills-group-header">
                    <div className="skills-group-title">
                      <span className="dot-miss" />
                      <strong>Missing Skills ({r.missing_skills.length})</strong>
                    </div>
                    <span className="muted small">Not detected on resume</span>
                  </div>
                  <div className="chips-wrap">
                    {r.missing_skills.length > 0 ? (
                      r.missing_skills.map((s) => (
                        <span
                          key={s.skill}
                          className={`chip ${s.required ? "chip-reqmiss" : "chip-miss"}`}
                          title={s.required ? "Required skill missing from resume" : "Preferred skill missing"}
                        >
                          <span>{s.skill}</span>
                          {s.required ? (
                            <span className="req-miss-tag">Required</span>
                          ) : (
                            <span className="pref-miss-tag">Preferred</span>
                          )}
                        </span>
                      ))
                    ) : (
                      <p className="chip chip-ok">Candidate covers all JD skills!</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: INTERVIEW PREPARATION */}
            {activeTab === "interview" && (
              <div className="tab-pane" role="tabpanel">
                <div className="interview-intro-card">
                  <h3 className="section-title">Targeted Screening Questions</h3>
                  <p className="muted small">
                    Auto-generated technical and behavioral prompts tailored specifically to the skill gaps identified between the JD and {p.name}'s resume.
                  </p>
                </div>

                {missingRequired.length > 0 ? (
                  <div className="interview-questions-list">
                    {missingRequired.map((s) => {
                      const questions = getInterviewQuestionsForSkill(s.skill);
                      return (
                        <div key={s.skill} className="interview-skill-card">
                          <div className="interview-skill-header">
                            <span className="chip chip-reqmiss">Missing: {s.skill}</span>
                            <span className="muted small">Required Qualification</span>
                          </div>
                          <ul className="interview-q-list">
                            {questions.map((q, idx) => (
                              <li key={idx} className="interview-q-item">
                                <span className="q-badge">Q{idx + 1}</span>
                                <span className="q-text">{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="interview-skill-card">
                    <div className="interview-skill-header">
                      <span className="chip chip-ok">All Required Skills Verified</span>
                    </div>
                    <p className="muted small">
                      This candidate does not have missing required skills. Suggested deep-dive questions based on their core competencies:
                    </p>
                    <ul className="interview-q-list">
                      {getInterviewQuestionsForSkill(r.matched_skills[0]?.skill || "Python").map((q, idx) => (
                        <li key={idx} className="interview-q-item">
                          <span className="q-badge">Q{idx + 1}</span>
                          <span className="q-text">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EXPERIENCE & EDUCATION */}
            {activeTab === "experience" && (
              <div className="tab-pane" role="tabpanel">
                <div className="exp-comparison-card">
                  <h3 className="section-title">Experience Comparison</h3>
                  <div className="exp-bars-flow">
                    <div className="exp-bar-item">
                      <div className="exp-bar-meta">
                        <span className="exp-role-title">Required by JD</span>
                        <span className="exp-val-bold">
                          {exp.required_years != null ? `${exp.required_years} years` : "None specified"}
                        </span>
                      </div>
                      <div className="scorebar">
                        <div
                          className="fill fill-muted"
                          style={{
                            width: `${exp.required_years ? ((exp.required_years / maxYears) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="exp-bar-item">
                      <div className="exp-bar-meta">
                        <span className="exp-role-title">Candidate Total Experience</span>
                        <span className="exp-val-bold">{exp.candidate_years} years</span>
                      </div>
                      <div className="scorebar">
                        <div
                          className="fill fill-brand"
                          style={{
                            width: `${((exp.candidate_years || 0) / maxYears) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="muted small">
                        Source: {p.experience_source === "dates" ? "Verifiable employment dates (deduplicated)" : "Stated on resume"}
                      </span>
                    </div>

                    <div className="exp-bar-item">
                      <div className="exp-bar-meta">
                        <span className="exp-role-title">Candidate Relevant Experience</span>
                        <span className="exp-val-bold">{exp.relevant_years} years</span>
                      </div>
                      <div className="scorebar">
                        <div
                          className="fill fill-good"
                          style={{
                            width: `${((exp.relevant_years || 0) / maxYears) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="muted small">
                        Weighted by jobs directly exercising required JD technologies
                      </span>
                    </div>
                  </div>
                </div>

                {/* Education Comparison */}
                <div className="edu-comparison-card">
                  <h3 className="section-title">Education Alignment</h3>
                  <div className="edu-details-grid">
                    <div className="edu-box">
                      <div className="edu-box-label">Candidate Degree</div>
                      <div className="edu-box-val">{r.education.candidate || "None detected"}</div>
                    </div>
                    <div className="edu-box">
                      <div className="edu-box-label">JD Requirement</div>
                      <div className="edu-box-val">{r.education.required || "Not specified"}</div>
                    </div>
                  </div>
                  <div className="edu-note muted small">
                    Highest degree contributes {r.breakdown.education.points} / 10 points based on target level hierarchy.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: EVIDENCE */}
            {activeTab === "evidence" && (
              <div className="tab-pane" role="tabpanel">
                <div className="evidence-header-note">
                  <p className="muted small">
                    Sentence embeddings evaluate semantic context and transferable achievements between specific job duties and candidate accomplishments.
                  </p>
                </div>

                {r.evidence && r.evidence.length > 0 ? (
                  <div className="evidence-list">
                    {r.evidence.map((ev, idx) => (
                      <div key={idx} className="evidence-card">
                        <div className="evidence-sim-badge">
                          <strong>{ev.similarity}%</strong> similarity match
                        </div>
                        <div className="evidence-row">
                          <span className="evidence-label">Job Expectation:</span>
                          <p className="evidence-text jd-text">{ev.jd_line}</p>
                        </div>
                        <div className="evidence-row">
                          <span className="evidence-label">Resume Accomplishment:</span>
                          <p className="evidence-text resume-text">{ev.resume_line}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-wrap">
                    <p className="muted">No specific semantic evidence pairs detected.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
