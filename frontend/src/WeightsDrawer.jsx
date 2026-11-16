import React, { useEffect } from "react";
import { CloseIcon, SparklesIcon, InfoIcon, AwardIcon } from "./Icons.jsx";

export const DEFAULT_WEIGHTS = {
  skills: 45,
  semantic: 25,
  experience: 20,
  education: 10,
};

export const PRESETS = [
  { name: "Default Balanced", weights: { skills: 45, semantic: 25, experience: 20, education: 10 }, desc: "Standard 45/25/20/10 blend" },
  { name: "Skills-Heavy", weights: { skills: 60, semantic: 15, experience: 15, education: 10 }, desc: "Prioritizes tech stack taxonomy" },
  { name: "Senior / Exp-Heavy", weights: { skills: 30, semantic: 15, experience: 45, education: 10 }, desc: "Values career tenure and longevity" },
  { name: "Semantic / Problem-Solving", weights: { skills: 25, semantic: 45, experience: 20, education: 10 }, desc: "Emphasizes transferable achievements" },
];

export default function WeightsDrawer({ isOpen, onClose, weights, onChangeWeights, onResetWeights }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTotal = weights.skills + weights.semantic + weights.experience + weights.education;

  // Proportional slider adjustment to maintain 100% total
  const handleSliderChange = (changedKey, newVal) => {
    const val = Math.max(0, Math.min(100, Math.round(newVal)));
    const remainingTarget = 100 - val;
    const otherKeys = ["skills", "semantic", "experience", "education"].filter((k) => k !== changedKey);
    const otherCurrentSum = otherKeys.reduce((acc, k) => acc + weights[k], 0);

    let nextWeights = { ...weights, [changedKey]: val };

    if (otherCurrentSum === 0) {
      // Split remaining equally among other keys
      const split = Math.floor(remainingTarget / otherKeys.length);
      otherKeys.forEach((k, idx) => {
        nextWeights[k] = idx === 0 ? remainingTarget - split * (otherKeys.length - 1) : split;
      });
    } else {
      // Distribute proportionally
      let distributed = 0;
      otherKeys.forEach((k, idx) => {
        if (idx === otherKeys.length - 1) {
          nextWeights[k] = Math.max(0, remainingTarget - distributed);
        } else {
          const share = Math.round((weights[k] / otherCurrentSum) * remainingTarget);
          nextWeights[k] = Math.max(0, share);
          distributed += nextWeights[k];
        }
      });
    }

    // Guarantee exact 100% sum
    const sum = Object.values(nextWeights).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const diff = 100 - sum;
      nextWeights[otherKeys[0]] = Math.max(0, nextWeights[otherKeys[0]] + diff);
    }

    onChangeWeights(nextWeights);
  };

  const isDefault =
    weights.skills === DEFAULT_WEIGHTS.skills &&
    weights.semantic === DEFAULT_WEIGHTS.semantic &&
    weights.experience === DEFAULT_WEIGHTS.experience &&
    weights.education === DEFAULT_WEIGHTS.education;

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside
        className="weights-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weights-drawer-title"
      >
        <div className="drawer-top-bar">
          <div className="drawer-nav-group">
            <span className="modal-icon-badge">
              <AwardIcon size={18} />
            </span>
            <h2 id="weights-drawer-title" className="weights-title">
              Adjust Scoring Weights
            </h2>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close settings (Escape)"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="weights-drawer-content">
          <div className="weights-info-banner">
            <InfoIcon size={16} />
            <span>
              Adjust the weight of each factor to fit the specific role. Ranking scores recompute instantly in the browser without re-running NLP models.
            </span>
          </div>

          {/* Quick Presets */}
          <div className="presets-section">
            <span className="presets-title">Recruiter Presets:</span>
            <div className="presets-grid">
              {PRESETS.map((p) => {
                const isActive =
                  weights.skills === p.weights.skills &&
                  weights.semantic === p.weights.semantic &&
                  weights.experience === p.weights.experience &&
                  weights.education === p.weights.education;
                return (
                  <button
                    key={p.name}
                    className={`preset-btn ${isActive ? "active" : ""}`}
                    onClick={() => onChangeWeights(p.weights)}
                    type="button"
                  >
                    <strong>{p.name}</strong>
                    <span className="preset-desc muted small">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="weights-sliders-list">
            {/* Skills */}
            <div className="weight-slider-card">
              <div className="weight-slider-header">
                <span className="slider-label">
                  <span className="comp-color-dot dot-skills" /> Skills Coverage
                </span>
                <span className="slider-pct">
                  <strong>{weights.skills}%</strong> (max {weights.skills} pts)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={weights.skills}
                onChange={(e) => handleSliderChange("skills", Number(e.target.value))}
                className="weight-slider slider-skills"
                aria-label="Skills coverage weight"
              />
              <span className="slider-hint muted small">
                Taxonomy keyword coverage (exact 1.0, implied 0.8, related 0.5)
              </span>
            </div>

            {/* Semantic */}
            <div className="weight-slider-card">
              <div className="weight-slider-header">
                <span className="slider-label">
                  <span className="comp-color-dot dot-semantic" /> Semantic Similarity
                </span>
                <span className="slider-pct">
                  <strong>{weights.semantic}%</strong> (max {weights.semantic} pts)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={weights.semantic}
                onChange={(e) => handleSliderChange("semantic", Number(e.target.value))}
                className="weight-slider slider-semantic"
                aria-label="Semantic similarity weight"
              />
              <span className="slider-hint muted small">
                Sentence embedding cosine similarity of work history vs JD bullets
              </span>
            </div>

            {/* Experience */}
            <div className="weight-slider-card">
              <div className="weight-slider-header">
                <span className="slider-label">
                  <span className="comp-color-dot dot-experience" /> Experience Timeline
                </span>
                <span className="slider-pct">
                  <strong>{weights.experience}%</strong> (max {weights.experience} pts)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={weights.experience}
                onChange={(e) => handleSliderChange("experience", Number(e.target.value))}
                className="weight-slider slider-exp"
                aria-label="Experience timeline weight"
              />
              <span className="slider-hint muted small">
                Verified employment tenure and relevant project years
              </span>
            </div>

            {/* Education */}
            <div className="weight-slider-card">
              <div className="weight-slider-header">
                <span className="slider-label">
                  <span className="comp-color-dot dot-education" /> Education Level
                </span>
                <span className="slider-pct">
                  <strong>{weights.education}%</strong> (max {weights.education} pts)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={weights.education}
                onChange={(e) => handleSliderChange("education", Number(e.target.value))}
                className="weight-slider slider-edu"
                aria-label="Education level weight"
              />
              <span className="slider-hint muted small">
                Degree alignment (meets target degree vs lower level)
              </span>
            </div>
          </div>

          {/* Sum Check & Reset */}
          <div className="weights-sum-bar">
            <span className="sum-text">
              Total Weight: <strong>{currentTotal}%</strong>
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onResetWeights}
              disabled={isDefault}
            >
              Reset to Default (45/25/20/10)
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Apply Weights
          </button>
        </div>
      </aside>
    </>
  );
}
