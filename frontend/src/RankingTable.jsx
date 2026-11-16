import React, { useState, useMemo, useEffect } from "react";
import {
  SearchIcon,
  FilterIcon,
  CompareIcon,
  StarIcon,
  CloseIcon,
  CheckIcon,
  AwardIcon,
  SparklesIcon,
  AlertCircleIcon,
} from "./Icons.jsx";

export const tone = (s) => (s >= 75 ? "strong" : s >= 60 ? "good" : s >= 40 ? "partial" : "weak");

export function ScoreRingMini({ value, size = 38, strokeWidth = 3.5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const t = tone(value);
  const strokeDashoffset = circumference - (Math.max(2, Math.min(100, value)) / 100) * circumference;

  return (
    <div className={`score-ring-mini score-${t}`} style={{ width: size, height: size }}>
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
      <span className="ring-text">{Math.round(value)}</span>
    </div>
  );
}

export function ScoreBar({ value }) {
  const t = tone(value);
  return (
    <div className="scorebar" title={`${value}%`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`fill ${t}`} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  );
}

export function RankBadge({ rank }) {
  if (rank === 1) {
    return (
      <span className="rank-badge rank-gold" title="Top match (Rank #1)">
        <span className="rank-num">1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="rank-badge rank-silver" title="Rank #2">
        <span className="rank-num">2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="rank-badge rank-bronze" title="Rank #3">
        <span className="rank-num">3</span>
      </span>
    );
  }
  return <span className="rank-badge rank-plain">#{rank}</span>;
}

export default function RankingTable({
  rows,
  onSelect,
  selectedId,
  job,
  compareIds = [],
  onToggleCompare,
  onOpenCompare,
  weights = { skills: 45, semantic: 25, experience: 20, education: 10 },
  onOpenWeights = () => {},
  mustHaveSkills = [],
  onToggleShortlist = () => {},
  isAnalyticsOpen = false,
  onToggleAnalytics = () => {},
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [sortBy, setSortBy] = useState("score-desc");
  const [onlyNoMissingReq, setOnlyNoMissingReq] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedSkillsRow, setExpandedSkillsRow] = useState(null);
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState(0);

  const isCustomWeights =
    weights &&
    (weights.skills !== 45 || weights.semantic !== 25 || weights.experience !== 20 || weights.education !== 10);

  const requiredSkillsList = useMemo(() => {
    return job?.parsed?.required_skills || [];
  }, [job]);

  // Recalculate scores if custom weights are active
  const computedRows = useMemo(() => {
    const list = rows.map((r) => {
      if (!isCustomWeights || !r.components) {
        return r;
      }
      const c = r.components;
      const raw =
        100 *
        ((weights.skills / 100) * (c.skills ?? 0) +
          (weights.semantic / 100) * (c.semantic ?? 0) +
          (weights.experience / 100) * (c.experience ?? 0) +
          (weights.education / 100) * (c.education ?? 0));
      const score = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
      const label =
        score >= 75 ? "Strong match" : score >= 60 ? "Good match" : score >= 40 ? "Partial match" : "Weak match";
      return { ...r, score, label };
    });

    if (isCustomWeights) {
      list.sort((a, b) => b.score - a.score || a.id - b.id);
      return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }
    return list;
  }, [rows, weights, isCustomWeights]);

  // Summary Metrics
  const metrics = useMemo(() => {
    if (!computedRows || computedRows.length === 0) {
      return { total: 0, avg: 0, top: 0, strongCount: 0, shortlistedCount: 0, rejectedCount: 0 };
    }
    const total = computedRows.length;
    const sum = computedRows.reduce((acc, r) => acc + r.score, 0);
    const avg = Math.round(sum / total);
    const top = Math.round(Math.max(...computedRows.map((r) => r.score)));
    const strongCount = computedRows.filter((r) => r.score >= 75).length;
    const shortlistedCount = computedRows.filter((r) => r.status === "shortlisted").length;
    const rejectedCount = computedRows.filter((r) => r.status === "rejected").length;
    return { total, avg, top, strongCount, shortlistedCount, rejectedCount };
  }, [computedRows]);

  // Filter and sort candidates
  const filteredRows = useMemo(() => {
    let result = [...computedRows];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => (r.status || "new") === statusFilter);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((r) => {
        const nameMatch = r.name.toLowerCase().includes(q);
        const titleMatch = (r.title || "").toLowerCase().includes(q);
        const fileMatch = (r.filename || "").toLowerCase().includes(q);
        const notesMatch = (r.notes || "").toLowerCase().includes(q);
        const skillMatch =
          r.matched_skills.some((s) => s.toLowerCase().includes(q)) ||
          r.partial_skills.some((s) => s.toLowerCase().includes(q));
        return nameMatch || titleMatch || fileMatch || notesMatch || skillMatch;
      });
    }

    // Min match filter
    if (minMatch > 0) {
      result = result.filter((r) => r.score >= minMatch);
    }

    // Missing no required skills toggle
    if (onlyNoMissingReq && requiredSkillsList.length > 0) {
      result = result.filter((r) => {
        const hasMissingReq = r.missing_skills.some((missing) =>
          requiredSkillsList.includes(missing)
        );
        return !hasMissingReq;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "score-desc") return b.score - a.score || a.rank - b.rank;
      if (sortBy === "score-asc") return a.score - b.score || a.rank - b.rank;
      if (sortBy === "exp-desc") return b.experience_years - a.experience_years || b.score - a.score;
      if (sortBy === "exp-asc") return a.experience_years - b.experience_years || b.score - a.score;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [computedRows, statusFilter, searchTerm, minMatch, onlyNoMissingReq, sortBy, requiredSkillsList]);

  // Keyboard navigation shortcuts: j (next), k (prev), Enter (open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (filteredRows.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardFocusIndex((prev) => Math.min(prev + 1, filteredRows.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardFocusIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter" && filteredRows[keyboardFocusIndex]) {
        e.preventDefault();
        onSelect(filteredRows[keyboardFocusIndex].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredRows, keyboardFocusIndex, onSelect]);

  const hasActiveFilters =
    searchTerm !== "" || minMatch > 0 || onlyNoMissingReq || statusFilter !== "all" || sortBy !== "score-desc";

  const clearFilters = () => {
    setSearchTerm("");
    setMinMatch(0);
    setStatusFilter("all");
    setOnlyNoMissingReq(false);
    setSortBy("score-desc");
  };

  return (
    <div className="ranking-dashboard">
      {/* Top summary strip */}
      <div className="metrics-strip">
        <div className="metric-card">
          <div className="metric-label">Total Candidates</div>
          <div className="metric-value">{metrics.total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Average Match</div>
          <div className="metric-value">{metrics.avg}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Top Score</div>
          <div className="metric-value highlight-gold">{metrics.top}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Strong Matches (≥75%)</div>
          <div className="metric-value strong-count">{metrics.strongCount}</div>
        </div>
      </div>

      {/* Recruiter Workflow Tabs: All / Shortlisted / New / Rejected */}
      <div className="recruiter-status-tabs" role="tablist" aria-label="Candidate review status tabs">
        <button
          className={`status-tab ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => setStatusFilter("all")}
          role="tab"
          aria-selected={statusFilter === "all"}
        >
          All Candidates ({metrics.total})
        </button>
        <button
          className={`status-tab status-tab-shortlist ${statusFilter === "shortlisted" ? "active" : ""}`}
          onClick={() => setStatusFilter("shortlisted")}
          role="tab"
          aria-selected={statusFilter === "shortlisted"}
        >
          <StarIcon size={13} className="tab-star-icon" /> Shortlisted ({metrics.shortlistedCount})
        </button>
        <button
          className={`status-tab ${statusFilter === "new" ? "active" : ""}`}
          onClick={() => setStatusFilter("new")}
          role="tab"
          aria-selected={statusFilter === "new"}
        >
          Unreviewed ({metrics.total - metrics.shortlistedCount - metrics.rejectedCount})
        </button>
        <button
          className={`status-tab status-tab-rejected ${statusFilter === "rejected" ? "active" : ""}`}
          onClick={() => setStatusFilter("rejected")}
          role="tab"
          aria-selected={statusFilter === "rejected"}
        >
          Rejected ({metrics.rejectedCount})
        </button>
      </div>

      {/* Toolbar Controls */}
      <div className="table-toolbar">
        <div className="toolbar-search-wrap">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, role, notes, or skill…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search candidates"
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-controls-group">
          {/* Min Score filter */}
          <div className="control-select-wrap">
            <span className="control-label">Score:</span>
            <select
              className="control-select"
              value={minMatch}
              onChange={(e) => setMinMatch(Number(e.target.value))}
              aria-label="Filter by minimum match percentage"
            >
              <option value={0}>All Scores</option>
              <option value={75}>≥ 75% Strong</option>
              <option value={60}>≥ 60% Good</option>
              <option value={40}>≥ 40% Partial</option>
            </select>
          </div>

          {/* Sort selector */}
          <div className="control-select-wrap">
            <span className="control-label">Sort:</span>
            <select
              className="control-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort candidates"
            >
              <option value="score-desc">Score (Highest)</option>
              <option value="score-asc">Score (Lowest)</option>
              <option value="exp-desc">Experience (Most)</option>
              <option value="exp-asc">Experience (Least)</option>
              <option value="name-asc">Candidate Name (A–Z)</option>
            </select>
          </div>

          {/* Toggle: Missing no required skills */}
          <label className="toggle-label" title="Show only candidates who have every required skill from the JD">
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={onlyNoMissingReq}
              onChange={(e) => setOnlyNoMissingReq(e.target.checked)}
            />
            <span className="toggle-text">All required skills met</span>
          </label>

          {/* Adjust Weights Button */}
          <button
            className={`btn btn-sm ${isCustomWeights ? "btn-primary" : "btn-secondary"}`}
            onClick={onOpenWeights}
            title="Adjust scoring weights sliders"
          >
            <AwardIcon size={14} />
            <span>
              {isCustomWeights
                ? `Weights: ${weights.skills}/${weights.semantic}/${weights.experience}/${weights.education}`
                : "Adjust Weights"}
            </span>
          </button>

          {/* Toggle Visual Analytics Button */}
          <button
            className={`btn btn-sm ${isAnalyticsOpen ? "btn-primary" : "btn-secondary"}`}
            onClick={onToggleAnalytics}
            title="Toggle Visual Analytics & Heatmap"
          >
            <SparklesIcon size={14} />
            <span>{isAnalyticsOpen ? "Hide Analytics" : "Visual Analytics"}</span>
          </button>

          {/* Clear filters button if active */}
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} title="Reset all filters">
              Reset filters
            </button>
          )}

          {/* Compare Selected Button */}
          {compareIds.length > 0 && (
            <button
              className={`btn btn-sm ${compareIds.length >= 2 ? "btn-primary" : "btn-secondary"}`}
              onClick={onOpenCompare}
              disabled={compareIds.length < 2}
              title={
                compareIds.length < 2
                  ? "Select at least 2 candidates to compare"
                  : `Compare ${compareIds.length} candidates side by side`
              }
            >
              <CompareIcon size={14} />
              <span>
                Compare ({compareIds.length}
                {compareIds.length < 2 ? "/2 req." : ""})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Comparison Selection & Keyboard Tip */}
      <div className="table-action-hint between">
        <span>
          Tip: Check 2–3 candidates to compare. Press <span className="kbd-pill">j</span>/<span className="kbd-pill">k</span> to navigate rows, <span className="kbd-pill">↵</span> to open, <span className="kbd-pill">Ctrl+K</span> for command search.
        </span>
        {isCustomWeights && (
          <span className="custom-weights-pill">
            Custom weights active: {weights.skills}% Skills · {weights.semantic}% Semantic · {weights.experience}% Exp · {weights.education}% Edu
          </span>
        )}
      </div>

      {/* Table with Sticky Header */}
      <div className="tablewrap" tabIndex={0} role="region" aria-label="Candidate ranking table">
        <table className="ranking-table">
          <thead>
            <tr>
              <th className="th-select" title="Select for comparison">
                <span className="sr-only">Compare</span>
              </th>
              <th className="th-star" title="Shortlist candidate">
                <span className="sr-only">Shortlist</span>
              </th>
              <th className="th-rank">Rank</th>
              <th className="th-candidate">Candidate</th>
              <th className="th-exp">Experience</th>
              <th className="th-match">Match %</th>
              <th className="th-skills">Matched Skills</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-table-cell">
                  <div className="empty-state-wrap">
                    <p className="empty-text">No candidates match your current filters or search query.</p>
                    <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => {
                const isSelected = r.id === selectedId;
                const isChecked = compareIds.includes(r.id);
                const isShortlisted = r.status === "shortlisted";
                const isRejected = r.status === "rejected";
                const isKeyboardFocused = idx === keyboardFocusIndex;
                const t = tone(r.score);
                const isExpanded = expandedSkillsRow === r.id;

                // Check must-have skills missing
                const missingMustHaves = mustHaveSkills.filter((mustSkill) =>
                  r.missing_skills.includes(mustSkill)
                );

                return (
                  <tr
                    key={r.id}
                    className={`ranking-row ${isSelected ? "row-selected" : ""} ${isChecked ? "row-compared" : ""} ${isKeyboardFocused ? "row-keyboard-focus" : ""} ${isRejected ? "row-rejected" : ""}`}
                    tabIndex={0}
                    onClick={() => {
                      setKeyboardFocusIndex(idx);
                      onSelect(r.id);
                    }}
                    role="button"
                    aria-label={`View analysis for ${r.name}, Match score ${Math.round(r.score)} percent`}
                  >
                    {/* Compare Checkbox */}
                    <td
                      className="cell-select"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="checkbox-wrap" title={`Select ${r.name} to compare`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isChecked && compareIds.length >= 3}
                          onChange={() => onToggleCompare(r.id)}
                          aria-label={`Compare ${r.name}`}
                        />
                        <span className="custom-check" />
                      </label>
                    </td>

                    {/* Shortlist Star Button */}
                    <td
                      className="cell-star"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleShortlist(r.id);
                      }}
                    >
                      <button
                        className={`star-toggle-btn ${isShortlisted ? "starred" : ""}`}
                        title={isShortlisted ? "Remove from shortlist" : "Star / Shortlist"}
                        aria-label={isShortlisted ? "Un-shortlist candidate" : "Shortlist candidate"}
                      >
                        <StarIcon size={14} className={isShortlisted ? "star-filled" : ""} />
                      </button>
                    </td>

                    {/* Rank Badge */}
                    <td className="cell-rank">
                      <RankBadge rank={r.rank} />
                    </td>

                    {/* Candidate Info */}
                    <td className="cell-candidate">
                      <div className="candidate-name-row">
                        <span className="candidate-name">{r.name}</span>
                        {isShortlisted && (
                          <span className="row-status-pill status-pill-shortlisted" title="Candidate shortlisted">
                            Shortlisted
                          </span>
                        )}
                        {isRejected && (
                          <span className="row-status-pill status-pill-rejected" title="Candidate rejected">
                            Rejected
                          </span>
                        )}
                        {r.score >= 75 && !isShortlisted && !isRejected && (
                          <span className="top-performer-badge" title="Strong match candidate">
                            <StarIcon size={10} /> Top
                          </span>
                        )}
                      </div>
                      <div className="candidate-title muted small">
                        {r.title || r.filename}
                      </div>

                      {/* Must-Have Skill Warning */}
                      {missingMustHaves.length > 0 && (
                        <div className="must-have-warning-pill" title={`Missing required must-have skill(s): ${missingMustHaves.join(", ")}`}>
                          <AlertCircleIcon size={11} />
                          <span>Missing Must-Have: {missingMustHaves.join(", ")}</span>
                        </div>
                      )}
                    </td>

                    {/* Experience */}
                    <td className="cell-exp">
                      <div className="exp-total-val">{r.experience_years} yrs</div>
                      {r.relevant_years !== r.experience_years ? (
                        <div className="exp-rel-val muted small">
                          {r.relevant_years} yrs relevant
                        </div>
                      ) : (
                        <div className="exp-rel-val muted small">fully relevant</div>
                      )}
                    </td>

                    {/* Match % with Circular Ring and Label */}
                    <td className="cell-match">
                      <div className="match-visual-cell">
                        <ScoreRingMini value={r.score} />
                        <div className="match-text-col">
                          <div className="match-pct-text">
                            <strong>{Math.round(r.score)}%</strong>
                          </div>
                          <span className={`match-tier-badge tier-${t}`}>
                            {r.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Matched Skills Chips */}
                    <td className="cell-skills" onClick={(e) => e.stopPropagation()}>
                      <div className="skills-chips-flow">
                        {(isExpanded ? r.matched_skills : r.matched_skills.slice(0, 5)).map((s) => (
                          <span key={s} className="chip chip-ok" title={`Matched skill: ${s}`}>
                            {s}
                          </span>
                        ))}
                        {r.matched_skills.length > 5 && (
                          <button
                            type="button"
                            className="chip-expand-btn"
                            onClick={() =>
                              setExpandedSkillsRow(isExpanded ? null : r.id)
                            }
                            aria-label={isExpanded ? "Show fewer skills" : `Show ${r.matched_skills.length - 5} more skills`}
                          >
                            {isExpanded ? "Show less" : `+${r.matched_skills.length - 5} more`}
                          </button>
                        )}
                        {r.matched_skills.length === 0 && (
                          <span className="muted small">None detected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer-note between">
        <span>Showing {filteredRows.length} of {rows.length} candidates</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
          title="View keyboard shortcuts"
        >
          Press <span className="kbd-pill">?</span> for shortcuts
        </button>
      </div>
    </div>
  );
}
