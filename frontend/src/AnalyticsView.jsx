import React, { useState, useMemo } from "react";
import { AwardIcon, SparklesIcon, CheckCircleIcon, CloseIcon, InfoIcon } from "./Icons.jsx";
import { tone } from "./RankingTable.jsx";

export default function AnalyticsView({ candidates, job, onSelectCandidate }) {
  const [activeTab, setActiveTab] = useState("heatmap");

  const jdSkills = useMemo(() => {
    if (!job?.parsed) return [];
    const req = (job.parsed.required_skills || []).map((s) => ({ skill: s, required: true }));
    const pref = (job.parsed.preferred_skills || []).map((s) => ({ skill: s, required: false }));
    return [...req, ...pref];
  }, [job]);

  // Histogram calculation
  const histogramBins = useMemo(() => {
    const bins = [
      { label: "< 40% (Weak)", min: 0, max: 39.9, count: 0, candidates: [], color: "var(--color-weak)" },
      { label: "40–59% (Partial)", min: 40, max: 59.9, count: 0, candidates: [], color: "var(--color-partial)" },
      { label: "60–74% (Good)", min: 60, max: 74.9, count: 0, candidates: [], color: "var(--color-good)" },
      { label: "75–100% (Strong)", min: 75, max: 100, count: 0, candidates: [], color: "var(--color-strong)" },
    ];

    candidates.forEach((c) => {
      for (const bin of bins) {
        if (c.score >= bin.min && c.score <= bin.max) {
          bin.count++;
          bin.candidates.push(c);
          break;
        }
      }
    });

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    return bins.map((b) => ({ ...b, heightPct: (b.count / maxCount) * 100 }));
  }, [candidates]);

  return (
    <div className="analytics-card card">
      <div className="analytics-header">
        <div className="analytics-title-wrap">
          <span className="modal-icon-badge">
            <SparklesIcon size={18} />
          </span>
          <div>
            <h3 className="analytics-title">Visual Candidate Analytics</h3>
            <span className="analytics-sub muted small">
              Deep comparison of score distribution, taxonomy heatmap, and multi-factor composition
            </span>
          </div>
        </div>

        <div className="analytics-tabs-group">
          <button
            className={`btn btn-sm ${activeTab === "heatmap" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("heatmap")}
          >
            Skills Heatmap
          </button>
          <button
            className={`btn btn-sm ${activeTab === "histogram" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("histogram")}
          >
            Score Histogram
          </button>
          <button
            className={`btn btn-sm ${activeTab === "breakdown" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("breakdown")}
          >
            Component Composition
          </button>
        </div>
      </div>

      <div className="analytics-body">
        {/* TAB A: SKILLS COVERAGE HEATMAP */}
        {activeTab === "heatmap" && (
          <div className="heatmap-section">
            <div className="heatmap-legend">
              <span className="legend-item"><span className="dot-ok" /> Exact Match (1.0 / 0.8)</span>
              <span className="legend-item"><span className="dot-partial" /> Partial Credit (Related / Via)</span>
              <span className="legend-item"><span className="dot-miss" /> Missing from Resume</span>
            </div>

            <div className="heatmap-scroll-wrap">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th className="heatmap-th-candidate">Candidate</th>
                    <th className="heatmap-th-score">Score</th>
                    {jdSkills.map((s) => (
                      <th key={s.skill} className={`heatmap-th-skill ${s.required ? "th-req" : "th-pref"}`}>
                        <div className="skill-th-content">
                          <span className="skill-name" title={s.skill}>{s.skill}</span>
                          <span className="skill-req-tag">{s.required ? "REQ" : "PREF"}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const matchedSet = new Set(c.matched_skills || []);
                    const partialSet = new Set(c.partial_skills || []);

                    return (
                      <tr key={c.id} className="heatmap-row" onClick={() => onSelectCandidate(c.id)}>
                        <td className="heatmap-candidate-cell">
                          <div className="heatmap-cand-name">{c.name}</div>
                          <span className="muted small">Rank #{c.rank}</span>
                        </td>
                        <td className="heatmap-score-cell">
                          <span className={`match-tier-badge tier-${tone(c.score)}`}>
                            {Math.round(c.score)}%
                          </span>
                        </td>
                        {jdSkills.map((s) => {
                          const isMatched = matchedSet.has(s.skill);
                          const isPartial = partialSet.has(s.skill);

                          let cellClass = "cell-miss";
                          let cellTitle = `${s.skill}: Missing from ${c.name}'s resume`;
                          let cellText = "—";

                          if (isMatched) {
                            cellClass = "cell-exact";
                            cellTitle = `${s.skill}: Exact / Full Match`;
                            cellText = "✓";
                          } else if (isPartial) {
                            cellClass = "cell-partial";
                            cellTitle = `${s.skill}: Partial credit via related skill`;
                            cellText = "∼";
                          }

                          return (
                            <td key={s.skill} className={`heatmap-cell ${cellClass}`} title={cellTitle}>
                              <span>{cellText}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB B: SCORE DISTRIBUTION HISTOGRAM */}
        {activeTab === "histogram" && (
          <div className="histogram-section">
            <div className="histogram-summary-note">
              Distribution of <strong>{candidates.length}</strong> candidates across score tiers. Higher cluster on the right signifies stronger candidate pool alignment.
            </div>

            <div className="histogram-chart-container">
              <div className="histogram-bars-row">
                {histogramBins.map((bin) => (
                  <div key={bin.label} className="histogram-col">
                    <div className="bar-wrapper">
                      <div
                        className="histogram-bar"
                        style={{
                          height: `${Math.max(12, bin.heightPct)}%`,
                          backgroundColor: bin.color,
                        }}
                      >
                        <span className="bar-count-label">{bin.count}</span>
                      </div>
                    </div>
                    <div className="histogram-bin-label">{bin.label}</div>
                    <span className="bin-pct-sub muted small">
                      {Math.round((bin.count / candidates.length) * 100)}% of pool
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB C: COMPONENT COMPOSITION STACKED BARS */}
        {activeTab === "breakdown" && (
          <div className="breakdown-section">
            <div className="breakdown-legend">
              <span className="legend-item"><span className="comp-color-dot dot-skills" /> Skills Coverage</span>
              <span className="legend-item"><span className="comp-color-dot dot-semantic" /> Semantic Similarity</span>
              <span className="legend-item"><span className="comp-color-dot dot-experience" /> Experience</span>
              <span className="legend-item"><span className="comp-color-dot dot-education" /> Education</span>
            </div>

            <div className="breakdown-bars-list">
              {candidates.map((c) => {
                const comp = c.components || { skills: 0, semantic: 0, experience: 0, education: 0 };
                const ptsSkills = (comp.skills * 45).toFixed(1);
                const ptsSem = (comp.semantic * 25).toFixed(1);
                const ptsExp = (comp.experience * 20).toFixed(1);
                const ptsEdu = (comp.education * 10).toFixed(1);

                return (
                  <div
                    key={c.id}
                    className="breakdown-cand-row"
                    onClick={() => onSelectCandidate(c.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="breakdown-cand-head">
                      <div className="breakdown-name-wrap">
                        <span className="cand-rank-sub">#{c.rank}</span>
                        <strong className="cand-name">{c.name}</strong>
                      </div>
                      <span className={`match-tier-badge tier-${tone(c.score)}`}>
                        {Math.round(c.score)}% ({c.label})
                      </span>
                    </div>

                    <div className="stacked-bar-container">
                      <div
                        className="stacked-segment segment-skills"
                        style={{ width: `${ptsSkills}%` }}
                        title={`Skills: ${ptsSkills} pts`}
                      />
                      <div
                        className="stacked-segment segment-semantic"
                        style={{ width: `${ptsSem}%` }}
                        title={`Semantic: ${ptsSem} pts`}
                      />
                      <div
                        className="stacked-segment segment-exp"
                        style={{ width: `${ptsExp}%` }}
                        title={`Experience: ${ptsExp} pts`}
                      />
                      <div
                        className="stacked-segment segment-edu"
                        style={{ width: `${ptsEdu}%` }}
                        title={`Education: ${ptsEdu} pts`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
