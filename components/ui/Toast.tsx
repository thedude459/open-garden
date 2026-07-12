"use client";

import type { ToastNotification } from "@/lib/planner/types";

interface ToastStackProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.variant}`}>
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
