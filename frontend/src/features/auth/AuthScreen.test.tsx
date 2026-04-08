import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthScreen } from "./AuthScreen";
import { ToastNotice } from "../../components/ToastRegion";

type AuthScreenProps = Parameters<typeof AuthScreen>[0];

function buildProps(overrides: Partial<AuthScreenProps> = {}): AuthScreenProps {
  return {
    email: "user@example.com",
    setEmail: vi.fn(),
    username: "grower",
    setUsername: vi.fn(),
    password: "secret",
    setPassword: vi.fn(),
    loginMode: "signin",
    setLoginMode: vi.fn(),
    authPane: "login",
    setAuthPane: vi.fn(),
    setResetToken: vi.fn(),
    resetPassword: "",
    setResetPassword: vi.fn(),
    handleAuth: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    handleForgotPassword: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    handleForgotUsername: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    submitPasswordReset: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    notices: [{ id: 1, message: "Welcome", kind: "info" }] as ToastNotice[],
    dismissNotice: vi.fn(),
    ...overrides,
  };
}

describe("AuthScreen", () => {
  it("supports signin, register, and forgot-flow navigation", () => {
    const props = buildProps();
    const { rerender } = render(<AuthScreen {...props} />);

    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot username?" }));
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as HTMLFormElement);

    expect(props.setLoginMode).toHaveBeenCalledWith("register");
    expect(props.setAuthPane).toHaveBeenCalledWith("forgot-password");
    expect(props.setAuthPane).toHaveBeenCalledWith("forgot-username");
    expect(props.handleAuth).toHaveBeenCalledTimes(1);

    rerender(<AuthScreen {...buildProps({ loginMode: "register" })} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("submits forgot-password, forgot-username, and reset panes", () => {
    const forgotPassword = buildProps({ authPane: "forgot-password" });
    const { rerender } = render(<AuthScreen {...forgotPassword} />);
    fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form") as HTMLFormElement);
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(forgotPassword.handleForgotPassword).toHaveBeenCalledTimes(1);
    expect(forgotPassword.setAuthPane).toHaveBeenCalledWith("login");

    const forgotUsername = buildProps({ authPane: "forgot-username" });
    rerender(<AuthScreen {...forgotUsername} />);
    fireEvent.submit(screen.getByRole("button", { name: "Send username" }).closest("form") as HTMLFormElement);
    expect(forgotUsername.handleForgotUsername).toHaveBeenCalledTimes(1);

    const reset = buildProps({ authPane: "reset", resetPassword: "new-secret" });
    rerender(<AuthScreen {...reset} />);
    fireEvent.submit(screen.getByRole("button", { name: "Reset password" }).closest("form") as HTMLFormElement);
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(reset.submitPasswordReset).toHaveBeenCalledTimes(1);
    expect(reset.setAuthPane).toHaveBeenCalledWith("login");
    expect(reset.setResetToken).toHaveBeenCalledWith(null);
  });

  it("fires field change handlers across auth panes", () => {
    const setEmail = vi.fn();
    const setUsername = vi.fn();
    const setPassword = vi.fn();
    const setResetPassword = vi.fn();

    // signin pane: username + password
    const { rerender } = render(
      <AuthScreen {...buildProps({ loginMode: "signin", setEmail, setUsername, setPassword, setResetPassword })} />,
    );
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user1" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass1" } });
    expect(setUsername).toHaveBeenCalledWith("user1");
    expect(setPassword).toHaveBeenCalledWith("pass1");

    // register pane: email field
    rerender(
      <AuthScreen {...buildProps({ loginMode: "register", setEmail, setUsername, setPassword })} />,
    );
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    expect(setEmail).toHaveBeenCalledWith("a@b.com");

    // forgot-password pane: email field
    rerender(
      <AuthScreen {...buildProps({ authPane: "forgot-password", setEmail })} />,
    );
    const forgotPwEmail = screen.getAllByLabelText("Email")[0];
    fireEvent.change(forgotPwEmail, { target: { value: "b@c.com" } });
    expect(setEmail).toHaveBeenCalledWith("b@c.com");

    // forgot-username pane: email field
    rerender(
      <AuthScreen {...buildProps({ authPane: "forgot-username", setEmail })} />,
    );
    const forgotUnEmail = screen.getAllByLabelText("Email")[0];
    fireEvent.change(forgotUnEmail, { target: { value: "c@d.com" } });
    expect(setEmail).toHaveBeenCalledWith("c@d.com");

    // reset pane: new password field
    rerender(
      <AuthScreen {...buildProps({ authPane: "reset", setResetPassword })} />,
    );
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass" } });
    expect(setResetPassword).toHaveBeenCalledWith("newpass");
  });

  it("navigates back from forgot-username to login", () => {
    const setAuthPane = vi.fn();
    render(<AuthScreen {...buildProps({ authPane: "forgot-username", setAuthPane })} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(setAuthPane).toHaveBeenCalledWith("login");
  });
});