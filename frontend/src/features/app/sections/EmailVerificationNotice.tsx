type EmailVerificationNoticeProps = {
  onResend: () => void;
};

export function EmailVerificationNotice({ onResend }: EmailVerificationNoticeProps) {
  return (
    <article className="card notice-card">
      <h3>Verify your email</h3>
      <p className="subhead">Password reset requires a verified email address.</p>
      <div className="panel-actions">
        <button type="button" onClick={onResend}>
          Resend verification email
        </button>
      </div>
    </article>
  );
}
