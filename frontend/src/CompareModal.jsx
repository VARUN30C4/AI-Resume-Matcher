import React, { useEffect, useState } from "react";
import { getCandidate } from "./api.js";
import { CloseIcon, CompareIcon, AwardIcon, CheckCircleIcon } from "./Icons.jsx";

export const tone = (s) => (s >= 75 ? "strong" : s >= 60 ? "good" : s >= 40 ? "partial" : "weak");

export default function CompareModal({ jobId, candidateIds, onClose, onRemoveCandidate }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!jobId || !candidateIds || candidateIds.length === 0) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    setErr("");
    Promise.all(candidateIds.map((id) => getCandidate(jobId, id)))
      .then((data) => {
        setCandidates(data);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message || "Failed to load candidate details for comparison");
        setLoading(false);
      });
  }, [jobId, candidateIds]);

  if (!candidateIds || candidateIds.length === 0) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card compare-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon-badge">
              <CompareIcon size={20} />
            </span>
            <div>
              <h2 id="compare-modal-title">Compare Candidates Side-by-Side</h2>
              <div className="modal-subtitle">
                Comparing {candidates.length} candidate{candidates.length === 1 ? "" : "s"} (select up to 3)
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close comparison">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body compare-modal-body">
          {loading && (
            <div className="compare-loading">
              <div className="spinner" />
              <p className="muted">Loading comparison data…</p>
            </div>
          )}

          {err && <div className="alert alert-error">{err}</div>}

          {!loading && !err && candidates.length > 0 && (
            <div className="compare-grid-wrap">
              <div
                className="compare-grid"
                style={{
                  gridTemplateColumns: `180px repeat(${candidates.length}, minmax(240px, 1fr))`,
                }}
              >
                {/* Header row: Candidate card */}
                <div className="compare-cell compare-cell-label header-label">Candidate</div>
                {candidates.map((c) => {
                  const t = tone(c.result.score);
                  return (
                    <div key={c.id} className="compare-cell compare-col-header">
                      <div className="compare-candidate-head">
                        <div className="compare-rank-badge">#{c.rank}</div>
                        <button
                          className="compare-remove-btn"
                          onClick={() => onRemoveCandidate(c.id)}
                          title="Remove from comparison"
                          aria-label={`Remove ${c.profile.name} from comparison`}
                        >
                          <CloseIcon size={12} />
                        </button>
                      </div>
                      <h3 className="compare-name">{c.profile.name}</h3>
                      <div className="compare-role muted small">
                        {c.profile.current_title || c.filename}
                      </div>
                      <div className={`compare-score-badge score-badge-${t}`}>
                        <strong>{Math.round(c.result.score)}%</strong>
                        <span>{c.result.label}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Score Breakdown Section */}
                <div className="compare-section-header" style={{ gridColumn: `span ${candidates.length + 1}` }}>
                  Score Breakdown (100 pts total)
                </div>

                <div className="compare-cell compare-cell-label">Skills (45%)</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.breakdown.skills.points} pts</strong>
                    <span className="muted small"> ({c.result.breakdown.skills.score}% coverage)</span>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Semantic (25%)</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.breakdown.semantic.points} pts</strong>
                    <span className="muted small"> ({c.result.breakdown.semantic.score}% similarity)</span>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Experience (20%)</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.breakdown.experience.points} pts</strong>
                    <span className="muted small"> ({c.result.breakdown.experience.score}%)</span>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Education (10%)</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.breakdown.education.points} pts</strong>
                    <span className="muted small"> ({c.result.breakdown.education.score}%)</span>
                  </div>
                ))}

                {/* Experience & Education Section */}
                <div className="compare-section-header" style={{ gridColumn: `span ${candidates.length + 1}` }}>
                  Experience & Education
                </div>

                <div className="compare-cell compare-cell-label">Total Experience</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.experience.candidate_years} yrs</strong>
                    <span className="muted small"> ({c.profile.experience_source})</span>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Relevant Experience</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <strong>{c.result.experience.relevant_years} yrs</strong>
                    {c.result.experience.required_years && (
                      <span className="muted small">
                        {" "}
                        / {c.result.experience.required_years} req.
                      </span>
                    )}
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Highest Degree</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <span>{c.result.education.candidate || "None detected"}</span>
                  </div>
                ))}

                {/* Skills Match Section */}
                <div className="compare-section-header" style={{ gridColumn: `span ${candidates.length + 1}` }}>
                  Skills Comparison
                </div>

                <div className="compare-cell compare-cell-label">Matched Skills</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <div className="chips-wrap">
                      {c.result.matched_skills.length > 0 ? (
                        c.result.matched_skills.map((s) => (
                          <span key={s.skill} className="chip chip-ok">
                            {s.skill}
                          </span>
                        ))
                      ) : (
                        <span className="muted small">None</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Partial Skills</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <div className="chips-wrap">
                      {c.result.partial_skills.length > 0 ? (
                        c.result.partial_skills.map((s) => (
                          <span
                            key={s.skill}
                            className="chip chip-partial"
                            title={`Via ${s.via} (${Math.round(s.credit * 100)}%)`}
                          >
                            {s.skill} <em className="sub-text">({s.via})</em>
                          </span>
                        ))
                      ) : (
                        <span className="muted small">None</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="compare-cell compare-cell-label">Missing Skills</div>
                {candidates.map((c) => (
                  <div key={c.id} className="compare-cell">
                    <div className="chips-wrap">
                      {c.result.missing_skills.length > 0 ? (
                        c.result.missing_skills.map((s) => (
                          <span
                            key={s.skill}
                            className={`chip ${s.required ? "chip-reqmiss" : "chip-miss"}`}
                          >
                            {s.skill} {s.required ? "*" : ""}
                          </span>
                        ))
                      ) : (
                        <span className="chip chip-ok">None missing!</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
