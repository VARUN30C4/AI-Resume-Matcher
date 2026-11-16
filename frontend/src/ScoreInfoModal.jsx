import React, { useEffect } from "react";
import { CloseIcon, InfoIcon, AwardIcon } from "./Icons.jsx";

export default function ScoreInfoModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon-badge">
              <AwardIcon size={20} />
            </span>
            <h2 id="score-modal-title">How Match % is Calculated</h2>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="formula-box">
            <div className="formula-label">Composite Match Formula</div>
            <code className="formula-code">
              Match % = 100 × ( 0.45 × Skills + 0.25 × Semantic + 0.20 × Experience + 0.10 × Education )
            </code>
          </div>

          <div className="weights-grid">
            <div className="weight-card">
              <div className="weight-header">
                <span className="weight-pct">45%</span>
                <span className="weight-title">Skills Coverage</span>
              </div>
              <p className="weight-desc">
                Matches candidate skills against JD requirements. Required skills weigh 2×, preferred weigh 1×.
              </p>
              <ul className="weight-details">
                <li><strong>1.0 credit:</strong> Exact skill match or alias (e.g., k8s = Kubernetes)</li>
                <li><strong>0.8 credit:</strong> Specific skill implies general (e.g., PostgreSQL → SQL)</li>
                <li><strong>0.5 credit:</strong> Related skill in same family (e.g., Flask → FastAPI)</li>
                <li><strong>up to 0.4:</strong> High embedding semantic similarity</li>
              </ul>
            </div>

            <div className="weight-card">
              <div className="weight-header">
                <span className="weight-pct">25%</span>
                <span className="weight-title">Semantic Similarity</span>
              </div>
              <p className="weight-desc">
                Sentence embedding cosine similarity between each JD requirement/responsibility line and candidate work bullets.
              </p>
              <ul className="weight-details">
                <li>Captures transferable achievements beyond exact keywords</li>
                <li>Calibrated with model-specific threshold range (0.20 → 0, 0.65 → 1.0)</li>
                <li>Includes top 3 strongest evidence pairs</li>
              </ul>
            </div>

            <div className="weight-card">
              <div className="weight-header">
                <span className="weight-pct">20%</span>
                <span className="weight-title">Experience Timeline</span>
              </div>
              <p className="weight-desc">
                Extracted from verifiable employment date ranges, strictly counting overlapping positions once.
              </p>
              <ul className="weight-details">
                <li>50% total verified career years vs required</li>
                <li>50% relevant years (jobs mentioning required role skills)</li>
                <li>No penalty for exceeding minimum requirements</li>
              </ul>
            </div>

            <div className="weight-card">
              <div className="weight-header">
                <span className="weight-pct">10%</span>
                <span className="weight-title">Education Level</span>
              </div>
              <p className="weight-desc">
                Evaluates highest achieved degree relative to job specification.
              </p>
              <ul className="weight-details">
                <li><strong>1.0:</strong> Meets or exceeds JD degree requirement</li>
                <li><strong>0.6:</strong> One level below target degree</li>
                <li><strong>0.3:</strong> No matching degree detected</li>
              </ul>
            </div>
          </div>

          <div className="score-tiers-box">
            <div className="tiers-title">Scoring Classification</div>
            <div className="tiers-row">
              <div className="tier-badge strong">
                <strong>≥ 75%</strong> Strong Match
              </div>
              <div className="tier-badge good">
                <strong>60–74%</strong> Good Match
              </div>
              <div className="tier-badge partial">
                <strong>40–59%</strong> Partial Match
              </div>
              <div className="tier-badge weak">
                <strong>&lt; 40%</strong> Weak Match
              </div>
            </div>
          </div>

          <div className="disclaimer-callout">
            <InfoIcon size={16} />
            <span>
              <strong>Recruiter Decision Support:</strong> Scores and explanations are designed as an objective screening aid to highlight evidence and candidate strengths, not as an automated hiring decision.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
