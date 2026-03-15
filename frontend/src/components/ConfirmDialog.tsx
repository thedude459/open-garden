type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirm-overlay" role="presentation">
      <section className="confirm-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-message">{message}</p>
        <div className="panel-actions">
          <button type="button" className="danger-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="secondary-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
