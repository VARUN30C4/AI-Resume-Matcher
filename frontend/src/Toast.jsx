import React from "react";
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, CloseIcon } from "./Icons.jsx";

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        const IconComponent =
          t.type === "success"
            ? CheckCircleIcon
            : t.type === "error"
            ? AlertCircleIcon
            : InfoIcon;

        return (
          <div key={t.id} className={`toast toast-${t.type || "info"}`} role="status">
            <span className="toast-icon">
              <IconComponent size={18} />
            </span>
            <div className="toast-message">{t.message}</div>
            {t.action && (
              <button
                className="toast-action-btn"
                onClick={() => {
                  t.action.onClick();
                  onDismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="toast-close"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
