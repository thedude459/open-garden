import { FormEvent, useState } from "react";
import { API } from "../constants";
import { AuthPane, LoginMode, TokenResponse } from "../types";

type NoticeKind = "info" | "success" | "error";

type UseAuthFlowParams = {
  setToken: (value: string) => void;
  authHeaders: Record<string, string>;
  pushNotice: (message: string, kind: NoticeKind) => void;
};

export function useAuthFlow({ setToken, authHeaders, pushNotice }: UseAuthFlowParams) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<LoginMode>("signin");
  const [authPane, setAuthPane] = useState<AuthPane>("login");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();

    if (loginMode === "register") {
      if (!email.trim()) {
        pushNotice("Email is required to create an account.", "error");
        return;
      }
      try {
        const registerResp = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), username, password }),
        });
        if (!registerResp.ok) {
          const message = (await registerResp.text()).trim();
          if (registerResp.status === 400 && message.toLowerCase().includes("already exists")) {
            pushNotice("Username already taken. Try a different one or sign in.", "error");
          } else {
            pushNotice(message || "Registration failed.", "error");
          }
          return;
        }
      } catch {
        pushNotice("Unable to reach the server.", "error");
        return;
      }
    }

    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const loginResp = await fetch(`${API}/auth/login`, {
      method: "POST",
      body,
    });
    if (!loginResp.ok) {
      pushNotice(
        loginMode === "signin"
          ? "Invalid username or password."
          : "Account created but sign-in failed. Please try signing in.",
        "error",
      );
      return;
    }

    const tokenData: TokenResponse = await loginResp.json();
    setToken(tokenData.access_token);
    localStorage.setItem("open-garden-token", tokenData.access_token);
    pushNotice(
      loginMode === "register"
        ? "Account created! Check your email to verify your address."
        : "Signed in successfully.",
      "success",
    );
  }

  async function verifyEmailToken(tokenToVerify: string) {
    const response = await fetch(`${API}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenToVerify }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Verification failed");
    }
  }

  async function requestPasswordReset(emailAddress: string) {
    const response = await fetch(`${API}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddress.trim() }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to send reset email");
    }
  }

  async function requestUsernameRecovery(emailAddress: string) {
    const response = await fetch(`${API}/auth/forgot-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddress.trim() }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to send username");
    }
  }

  async function resendVerificationEmail() {
    const response = await fetch(`${API}/auth/resend-verification`, {
      method: "POST",
      headers: authHeaders,
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to resend verification email");
    }
  }

  async function submitPasswordReset(e: FormEvent) {
    e.preventDefault();
    if (!resetToken) {
      pushNotice("Reset token is missing.", "error");
      return;
    }
    if (resetPassword.length < 8) {
      pushNotice("Password must be at least 8 characters.", "error");
      return;
    }

    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: resetPassword }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Unable to reset password");
      }
      setResetPassword("");
      setResetToken(null);
      setAuthPane("login");
      pushNotice("Password reset successful. Please sign in.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to reset password.", "error");
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      pushNotice("Enter your email to request a reset.", "error");
      return;
    }
    try {
      await requestPasswordReset(email);
      pushNotice("If the account exists, reset instructions were sent.", "success");
      setAuthPane("login");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to request password reset.", "error");
    }
  }

  async function handleForgotUsername(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      pushNotice("Enter your email to request your username.", "error");
      return;
    }
    try {
      await requestUsernameRecovery(email);
      pushNotice("If the account exists, username recovery instructions were sent.", "success");
      setAuthPane("login");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to request username.", "error");
    }
  }

  return {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    loginMode,
    setLoginMode,
    authPane,
    setAuthPane,
    resetToken,
    setResetToken,
    resetPassword,
    setResetPassword,
    isEmailVerified,
    setIsEmailVerified,
    handleAuth,
    verifyEmailToken,
    resendVerificationEmail,
    submitPasswordReset,
    handleForgotPassword,
    handleForgotUsername,
  };
}
