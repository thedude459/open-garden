type ToastKind = "info" | "success" | "error";

export type ToastNotice = {
  id: number;
  message: string;
  kind: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastRegionProps = {
  notices: ToastNotice[];
  onDismiss: (id: number) => void;
  onAction: (id: number) => void;
};

export function ToastRegion({ notices, onDismiss, onAction }: ToastRegionProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
      {notices.map((notice) => (
        <article key={notice.id} className={`toast toast-${notice.kind}`}>
          <p className="toast-message">{notice.message}</p>
          {notice.actionLabel && notice.onAction && (
            <button type="button" className="toast-action" onClick={() => onAction(notice.id)}>
              {notice.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(notice.id)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </article>
      ))}
    </div>
  );
}
