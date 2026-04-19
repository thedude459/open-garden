type EmailVerificationNoticeProps = {
  onResend: () => void;
  /** Kept for backwards compatibility; the notice is now always rendered compactly. */
  compact?: boolean;
  onDismiss?: () => void;
};

export function EmailVerificationNotice({ onResend, onDismiss }: EmailVerificationNoticeProps) {
  return (
    <article className="notice-bar notice-bar--warning" role="note" aria-label="Email verification reminder">
      <div className="notice-bar__body">
        <strong className="notice-bar__title">Verify your email</strong>
        <span className="notice-bar__text">Confirm your address so we can send password resets and plan updates.</span>
      </div>
      <div className="notice-bar__actions">
        <button type="button" className="secondary-btn notice-bar__action" onClick={onResend}>
          Resend email
        </button>
        {onDismiss && (
          <button
            type="button"
            className="notice-bar__close"
            aria-label="Hide verification reminder"
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </article>
  );
}
