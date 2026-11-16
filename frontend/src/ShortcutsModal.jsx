import React, { useEffect } from "react";
import { CloseIcon, InfoIcon } from "./Icons.jsx";

export default function ShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: "j / ↓", desc: "Move focus to next candidate row in table" },
    { key: "k / ↑", desc: "Move focus to previous candidate row in table" },
    { key: "Enter", desc: "Open candidate analysis drawer for highlighted row" },
    { key: "← / →", desc: "Navigate between candidates inside the drawer" },
    { key: "Ctrl + K / ⌘K", desc: "Open Command Palette quick search" },
    { key: "Esc", desc: "Close open drawer, modal, or palette" },
    { key: "?", desc: "Open this keyboard shortcuts reference" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card shortcuts-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon-badge">⌨️</span>
            <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close shortcuts">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="shortcuts-table">
            {shortcuts.map((s) => (
              <div key={s.key} className="shortcut-row">
                <span className="shortcut-key">
                  <span className="kbd-pill">{s.key}</span>
                </span>
                <span className="shortcut-desc">{s.desc}</span>
              </div>
            ))}
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
