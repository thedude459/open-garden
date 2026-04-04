import { FormEvent } from "react";
import { ToastRegion } from "../../components/ToastRegion";
import { AuthPane, LoginMode } from "../app/types";
import { ToastNotice } from "../../components/ToastRegion";

type AuthScreenProps = {
  // Form state
  email: string;
  setEmail: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loginMode: LoginMode;
  setLoginMode: (v: LoginMode) => void;
  authPane: AuthPane;
  setAuthPane: (v: AuthPane) => void;
  setResetToken: (v: string | null) => void;
  resetPassword: string;
  setResetPassword: (v: string) => void;
  // Handlers
  handleAuth: (e: FormEvent<HTMLFormElement>) => void;
  handleForgotPassword: (e: FormEvent<HTMLFormElement>) => void;
  handleForgotUsername: (e: FormEvent<HTMLFormElement>) => void;
  submitPasswordReset: (e: FormEvent<HTMLFormElement>) => void;
  // Notices
  notices: ToastNotice[];
  dismissNotice: (id: number) => void;
};

export function AuthScreen({
  email, setEmail,
  username, setUsername,
  password, setPassword,
  loginMode, setLoginMode,
  authPane, setAuthPane,
  setResetToken,
  resetPassword, setResetPassword,
  handleAuth,
  handleForgotPassword,
  handleForgotUsername,
  submitPasswordReset,
  notices,
  dismissNotice,
}: AuthScreenProps) {
  return (
    <main className="shell center">
      <section className="card login-card">
        <h1>open-garden</h1>
        <p>Calendar-driven garden planning with visual bed design.</p>

        {authPane === "login" && (
          <>
            <div className="auth-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={loginMode === "signin"}
                className={loginMode === "signin" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setLoginMode("signin")}
              >
                Sign in
              </button>
              <button
                role="tab"
                aria-selected={loginMode === "register"}
                className={loginMode === "register" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setLoginMode("register")}
              >
                Create account
              </button>
            </div>
            <form onSubmit={handleAuth} className="stack">
              {loginMode === "register" && (
                <div className="stack compact">
                  <label className="field-label" htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
              )}
              <div className="stack compact">
                <label className="field-label" htmlFor="login-username">Username</label>
                <input id="login-username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required autoComplete="username" />
              </div>
              <div className="stack compact">
                <label className="field-label" htmlFor="login-password">Password</label>
                <input id="login-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" required autoComplete={loginMode === "register" ? "new-password" : "current-password"} />
              </div>
              <button type="submit">{loginMode === "register" ? "Create account" : "Sign in"}</button>
              {loginMode === "signin" && (
                <>
                  <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-password")}>
                    Forgot password?
                  </button>
                  <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-username")}>
                    Forgot username?
                  </button>
                </>
              )}
            </form>
          </>
        )}

        {authPane === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="stack">
            <h3>Password reset</h3>
            <p className="subhead">Enter your verified account email to request a reset link.</p>
            <div className="stack compact">
              <label className="field-label" htmlFor="forgot-email">Email</label>
              <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <button type="submit">Send reset link</button>
            <button type="button" className="link-btn" onClick={() => setAuthPane("login")}>Back to sign in</button>
          </form>
        )}

        {authPane === "forgot-username" && (
          <form onSubmit={handleForgotUsername} className="stack">
            <h3>Recover username</h3>
            <p className="subhead">Enter your verified account email to receive your username.</p>
            <div className="stack compact">
              <label className="field-label" htmlFor="forgot-username-email">Email</label>
              <input id="forgot-username-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <button type="submit">Send username</button>
            <button type="button" className="link-btn" onClick={() => setAuthPane("login")}>Back to sign in</button>
          </form>
        )}

        {authPane === "reset" && (
          <form onSubmit={submitPasswordReset} className="stack">
            <h3>Set new password</h3>
            <p className="subhead">Enter a new password for your account.</p>
            <div className="stack compact">
              <label className="field-label" htmlFor="reset-password">New password</label>
              <input id="reset-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="new password" required autoComplete="new-password" />
            </div>
            <button type="submit">Reset password</button>
            <button type="button" className="link-btn" onClick={() => { setAuthPane("login"); setResetToken(null); }}>Back to sign in</button>
          </form>
        )}
      </section>
      <ToastRegion notices={notices} onDismiss={dismissNotice} onAction={dismissNotice} />
    </main>
  );
}
