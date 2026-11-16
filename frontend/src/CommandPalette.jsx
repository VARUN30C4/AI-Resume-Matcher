import React, { useState, useEffect, useRef } from "react";
import { SearchIcon, CloseIcon, StarIcon, AwardIcon } from "./Icons.jsx";
import { tone } from "./RankingTable.jsx";

export default function CommandPalette({
  isOpen,
  onClose,
  candidates = [],
  onSelectCandidate,
  onOpenWeights,
  onOpenTour,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].action();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex]);

  if (!isOpen) return null;

  const candidateActions = candidates.map((c) => ({
    id: `cand-${c.id}`,
    type: "candidate",
    title: c.name,
    subtitle: `${c.title || c.filename} · ${Math.round(c.score)}% (${c.label})`,
    score: c.score,
    status: c.status,
    action: () => {
      onSelectCandidate(c.id);
      onClose();
    },
  }));

  const globalActions = [
    {
      id: "action-weights",
      type: "action",
      title: "Adjust Scoring Weights (Sliders)",
      subtitle: "Customize weights for skills, semantic, experience & education",
      action: () => {
        onOpenWeights();
        onClose();
      },
    },
    {
      id: "action-tour",
      type: "action",
      title: "Start Guided Product Tour",
      subtitle: "4-step walkthrough of features and ranking analysis",
      action: () => {
        onOpenTour();
        onClose();
      },
    },
  ];

  const allItems = [...globalActions, ...candidateActions];
  const q = query.toLowerCase().trim();
  const filteredItems = q
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q))
      )
    : allItems;

  return (
    <div className="modal-backdrop command-backdrop" onClick={onClose}>
      <div
        className="command-palette-card"
        role="dialog"
        aria-modal="true"
        aria-label="Command search palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-input-wrap">
          <SearchIcon size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder="Type a candidate name, skill, or action (e.g. 'Weights', 'Aarav')…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button className="command-close-btn" onClick={onClose} aria-label="Close command palette">
            <span className="kbd-pill">ESC</span>
          </button>
        </div>

        <div className="command-results-list" role="listbox">
          {filteredItems.length === 0 ? (
            <div className="command-empty-item">No matching candidates or actions found.</div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`command-item ${isSelected ? "command-item-active" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="command-item-left">
                    {item.type === "action" ? (
                      <span className="command-item-icon">⚡</span>
                    ) : (
                      <span className={`match-tier-badge tier-${tone(item.score)}`}>
                        {Math.round(item.score)}%
                      </span>
                    )}
                    <div>
                      <div className="command-item-title">{item.title}</div>
                      <div className="command-item-sub muted small">{item.subtitle}</div>
                    </div>
                  </div>
                  {item.status === "shortlisted" && (
                    <span className="status-badge-shortlisted small">
                      <StarIcon size={10} /> Shortlist
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="command-footer">
          <span>
            <span className="kbd-pill">↑</span> <span className="kbd-pill">↓</span> Navigate
          </span>
          <span>
            <span className="kbd-pill">↵</span> Select
          </span>
          <span>
            <span className="kbd-pill">ESC</span> Close
          </span>
        </div>
      </div>
    </div>
  );
}
