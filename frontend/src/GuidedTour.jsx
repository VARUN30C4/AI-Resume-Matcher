import React, { useState } from "react";
import { CloseIcon, SparklesIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from "./Icons.jsx";

const TOUR_STEPS = [
  {
    step: 1,
    title: "1. Job Description & Taxonomy Extraction",
    content:
      "Start by pasting a job description or uploading a document (or click 'Load sample JD'). The NLP engine automatically extracts required vs. preferred skills, minimum experience thresholds, and qualification requirements.",
  },
  {
    step: 2,
    title: "2. Batch Resume Parsing (PDF & DOCX)",
    content:
      "Batch upload 10+ candidate resumes. The parser deduplicates employment dates, tracks timeline overlap, and matches technical aliases against an extensive skills taxonomy.",
  },
  {
    step: 3,
    title: "3. Ranking Dashboard & Custom Weights",
    content:
      "Candidates are ranked on a 0–100 scale combining Skills (45%), Semantic Alignment (25%), Experience (20%), and Education (10%). Click 'Adjust Weights' to tune factors live to your hiring needs.",
  },
  {
    step: 4,
    title: "4. Candidate Evidence & Interview Prep",
    content:
      "Click any candidate row to view detailed evidence pairs, missing skill gaps, auto-generated interview questions, recruiter notes, and one-click PDF dossiers.",
  },
];

export default function GuidedTour({ isOpen, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (!isOpen) return null;

  const current = TOUR_STEPS[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  return (
    <div className="modal-backdrop tour-backdrop" onClick={onClose}>
      <div
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tour-header">
          <div className="tour-pill">
            <SparklesIcon size={14} /> Quick Tour ({currentIdx + 1} of {TOUR_STEPS.length})
          </div>
          <button className="tour-close-btn" onClick={onClose} aria-label="Skip tour">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="tour-body">
          <h3 id="tour-title" className="tour-title">{current.title}</h3>
          <p className="tour-text">{current.content}</p>

          <div className="tour-dots-row">
            {TOUR_STEPS.map((s, idx) => (
              <span
                key={s.step}
                className={`tour-dot ${idx === currentIdx ? "tour-dot-active" : ""}`}
                onClick={() => setCurrentIdx(idx)}
              />
            ))}
          </div>
        </div>

        <div className="tour-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Skip tour
          </button>

          <div className="tour-nav-buttons">
            {!isFirst && (
              <button className="btn btn-secondary btn-sm" onClick={handlePrev}>
                <ChevronLeftIcon size={14} /> Previous
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleNext}>
              <span>{isLast ? "Get Started" : "Next"}</span>
              {!isLast && <ChevronRightIcon size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
