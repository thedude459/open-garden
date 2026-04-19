import { FormEvent } from "react";
import { CalendarDays, LayoutGrid, Leaf, Sprout } from "lucide-react";
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
    <main className="auth-shell">
      <aside className="auth-hero" aria-hidden>
        <div className="auth-hero__content">
          <span className="auth-hero__eyebrow">
            <Leaf size={14} strokeWidth={2.5} />
            Grow with confidence
          </span>
          <h2 className="auth-hero__title">
            Plan your garden.<br />
            Grow what you love.
          </h2>
          <p className="auth-hero__lede">
            A calendar-driven planner for home gardeners. Lay out your beds,
            schedule plantings, and let us handle the watering, weeding, and
            harvest reminders — tailored to your ZIP code.
          </p>
          <ul className="auth-hero__list">
            <li className="auth-hero__item">
              <span className="auth-hero__icon"><Sprout size={16} strokeWidth={2.2} /></span>
              <span>
                <strong>Zone-aware planting.</strong> Frost dates, soil temps,
                and microclimate built in.
              </span>
            </li>
            <li className="auth-hero__item">
              <span className="auth-hero__icon"><LayoutGrid size={16} strokeWidth={2.2} /></span>
              <span>
                <strong>Visual bed planner.</strong> Drag beds in your yard,
                drop crops on a square-foot grid.
              </span>
            </li>
            <li className="auth-hero__item">
              <span className="auth-hero__icon"><CalendarDays size={16} strokeWidth={2.2} /></span>
              <span>
                <strong>Auto-generated to-dos.</strong> Sow, transplant, water,
                and harvest tasks on your calendar.
              </span>
            </li>
          </ul>
        </div>
        <p className="auth-hero__foot">
          Open-source. Made for home gardeners — not commercial farms.
        </p>
      </aside>

      <section className="card auth-card">
        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden>
            <Leaf strokeWidth={2.25} />
          </span>
          <div>
            <div className="auth-brand__wordmark">open-garden</div>
            <div className="auth-brand__tagline">Calendar-driven garden planning.</div>
          </div>
        </div>

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
                <div className="inline" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.35rem" }}>
                  <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-password")}>
                    Forgot password?
                  </button>
                  <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-username")}>
                    Forgot username?
                  </button>
                </div>
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
