import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthFlow } from "./useAuthFlow";

function makeEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

describe("useAuthFlow", () => {
  const setToken = vi.fn();
  const pushNotice = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    setToken.mockReset();
    pushNotice.mockReset();
    localStorage.clear();
  });

  it("requires email before registration", async () => {
    const { result } = renderHook(() =>
      useAuthFlow({ setToken, authHeaders: { Authorization: "Bearer t" }, pushNotice }),
    );

    act(() => {
      result.current.setLoginMode("register");
      result.current.setUsername("u");
      result.current.setPassword("p");
      result.current.setEmail("   ");
    });

    await act(async () => {
      await result.current.handleAuth(makeEvent());
    });

    expect(pushNotice).toHaveBeenCalledWith("Email is required to create an account.", "error");
  });

  it("registers and signs in successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn(async () => "") })
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn(async () => ({ access_token: "tok" })) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAuthFlow({ setToken, authHeaders: { Authorization: "Bearer t" }, pushNotice }),
    );

    act(() => {
      result.current.setLoginMode("register");
      result.current.setEmail("user@example.com");
      result.current.setUsername("user");
      result.current.setPassword("secret");
    });

    await act(async () => {
      await result.current.handleAuth(makeEvent());
    });

    expect(setToken).toHaveBeenCalledWith("tok");
    expect(localStorage.getItem("open-garden-token")).toBe("tok");
    expect(pushNotice).toHaveBeenCalledWith("Account created! Check your email to verify your address.", "success");
  });

  it("handles sign in failure and reset/forgot flows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAuthFlow({ setToken, authHeaders: { Authorization: "Bearer t" }, pushNotice }),
    );

    act(() => {
      result.current.setUsername("user");
      result.current.setPassword("bad");
      result.current.setEmail("user@example.com");
    });

    await act(async () => {
      await result.current.handleAuth(makeEvent());
    });

    expect(pushNotice).toHaveBeenCalledWith("Invalid username or password.", "error");

    await act(async () => {
      await result.current.handleForgotPassword(makeEvent());
      await result.current.handleForgotUsername(makeEvent());
      await result.current.resendVerificationEmail();
    });

    expect(pushNotice).toHaveBeenCalledWith("If the account exists, reset instructions were sent.", "success");
    expect(pushNotice).toHaveBeenCalledWith("If the account exists, username recovery instructions were sent.", "success");
  });

  it("validates and submits password reset", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAuthFlow({ setToken, authHeaders: { Authorization: "Bearer t" }, pushNotice }),
    );

    await act(async () => {
      await result.current.submitPasswordReset(makeEvent());
    });
    expect(pushNotice).toHaveBeenCalledWith("Reset token is missing.", "error");

    act(() => {
      result.current.setResetToken("token");
      result.current.setResetPassword("short");
    });
    await act(async () => {
      await result.current.submitPasswordReset(makeEvent());
    });
    expect(pushNotice).toHaveBeenCalledWith("Password must be at least 8 characters.", "error");

    act(() => {
      result.current.setResetPassword("long-enough");
    });
    await act(async () => {
      await result.current.submitPasswordReset(makeEvent());
      await result.current.verifyEmailToken("verify-token");
    });

    expect(pushNotice).toHaveBeenCalledWith("Password reset successful. Please sign in.", "success");
  });
});
