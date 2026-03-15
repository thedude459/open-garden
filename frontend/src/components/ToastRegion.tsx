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
          <p>{notice.message}</p>
          <div className="toast-actions">
            {notice.actionLabel && notice.onAction && (
              <button type="button" className="secondary-btn" onClick={() => onAction(notice.id)}>
                {notice.actionLabel}
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={() => onDismiss(notice.id)}>
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
