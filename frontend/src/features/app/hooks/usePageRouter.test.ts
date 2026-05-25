import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Garden } from "../../types";
import { usePageRouter } from "./usePageRouter";

function hookWrapper(initialEntry = "/home") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, children);
  };
}

describe("usePageRouter", () => {
  const mockAuthFlow = {
    setIsEmailVerified: vi.fn(),
    setResetToken: vi.fn(),
    setAuthPane: vi.fn(),
    verifyEmailToken: vi.fn(),
  };

  const mockPushNotice = vi.fn();
  const mockSetSelectedGarden = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("open-garden-help-seen");
    window.history.replaceState(null, "", "/");
  });

  it("should initialize with default page (home) and state", () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    expect(result.current.activePage).toBe("home");
    expect(result.current.isNavOpen).toBe(false);
    expect(result.current.isHelpOpen).toBe(true);
    expect(result.current.placementBedId).toBeNull();
  });

  it("should navigate to a garden-scoped page and close nav", () => {
    const gardens: Garden[] = [{ id: 1 } as unknown as Garden];
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: 1,
          setSelectedGarden: mockSetSelectedGarden,
          gardens,
        }),
      { wrapper: hookWrapper("/home") }
    );

    act(() => {
      result.current.setIsNavOpen(true);
      result.current.navigateTo("planner");
    });

    expect(result.current.activePage).toBe("planner");
    expect(result.current.isNavOpen).toBe(false);
  });

  it("should show help modal on first login if not seen before", async () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    await waitFor(() => {
      expect(result.current.isHelpOpen).toBe(true);
    });
  });

  it("should manage month cursor and selected date state", () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    const newMonth = new Date(2024, 5, 1);
    const newDate = "2024-06-15";

    act(() => {
      result.current.setMonthCursor(newMonth);
      result.current.setSelectedDate(newDate);
    });

    expect(result.current.monthCursor).toEqual(newMonth);
    expect(result.current.selectedDate).toBe(newDate);
  });

  it("should manage placement bed ID state", () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    expect(result.current.placementBedId).toBeNull();

    act(() => {
      result.current.setPlacementBedId(42);
    });

    expect(result.current.placementBedId).toBe(42);
  });

  it("should not navigate to garden tools without a selected garden", async () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    act(() => {
      result.current.navigateTo("planner");
    });

    await waitFor(() => {
      expect(result.current.activePage).toBe("home");
    });
    expect(mockPushNotice).toHaveBeenCalled();
  });

  it("should close nav when route changes", () => {
    const gardens: Garden[] = [{ id: 1 } as unknown as Garden];
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: 1,
          setSelectedGarden: mockSetSelectedGarden,
          gardens,
        }),
      { wrapper: hookWrapper("/home") }
    );

    act(() => {
      result.current.setIsNavOpen(true);
    });

    expect(result.current.isNavOpen).toBe(true);

    act(() => {
      result.current.navigateTo("calendar");
    });

    expect(result.current.isNavOpen).toBe(false);
  });

  it("handles email verification tokens in the URL", async () => {
    mockAuthFlow.verifyEmailToken.mockResolvedValueOnce(undefined);
    window.history.replaceState(null, "", "/?verify_token=abc123");

    renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    await waitFor(() => {
      expect(mockAuthFlow.verifyEmailToken).toHaveBeenCalledWith("abc123");
    });

    expect(mockAuthFlow.setIsEmailVerified).toHaveBeenCalledWith(true);
    expect(mockPushNotice).toHaveBeenCalledWith(
      "Email verified. Password reset is now available.",
      "success"
    );
    expect(window.location.search).toBe("");
  });

  it("handles reset tokens in the URL", async () => {
    window.history.replaceState(null, "", "/?reset_token=reset-456");

    renderHook(
      () =>
        usePageRouter({
          token: "",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    await waitFor(() => {
      expect(mockAuthFlow.setResetToken).toHaveBeenCalledWith("reset-456");
    });

    expect(mockAuthFlow.setAuthPane).toHaveBeenCalledWith("reset");
    expect(window.location.search).toBe("");
  });

  it("surfaces verification errors from the URL token flow", async () => {
    mockAuthFlow.verifyEmailToken.mockRejectedValueOnce(new Error("Link expired"));
    window.history.replaceState(null, "", "/?verify_token=expired-token");

    renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    await waitFor(() => {
      expect(mockPushNotice).toHaveBeenCalledWith("Link expired", "error");
    });

    expect(window.location.search).toBe("");
  });

  it("keeps help modal closed after the first-login hint has been seen", () => {
    localStorage.setItem("open-garden-help-seen", "1");

    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    expect(result.current.isHelpOpen).toBe(false);
  });

  it("allows crop library navigation without a selected garden", () => {
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens: [],
        }),
      { wrapper: hookWrapper("/home") }
    );

    act(() => {
      result.current.navigateTo("crops");
    });

    expect(result.current.activePage).toBe("crops");
  });

  it("resumeAfterGardenPick navigates to an intended tool path", () => {
    sessionStorage.setItem("open-garden-intended-page", "calendar");
    const gardens: Garden[] = [{ id: 7 } as unknown as Garden];
    const { result } = renderHook(
      () =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden: null,
          setSelectedGarden: mockSetSelectedGarden,
          gardens,
        }),
      { wrapper: hookWrapper("/home") }
    );

    act(() => {
      result.current.resumeAfterGardenPick(7);
    });

    expect(result.current.activePage).toBe("calendar");
    expect(sessionStorage.getItem("open-garden-intended-page")).toBeNull();
  });
});
