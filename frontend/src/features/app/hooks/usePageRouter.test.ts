import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageRouter } from "./usePageRouter";

describe("usePageRouter", () => {
  const mockAuthFlow = {
    setIsEmailVerified: vi.fn(),
    setResetToken: vi.fn(),
    setAuthPane: vi.fn(),
    verifyEmailToken: vi.fn(),
  };

  const mockPushNotice = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("open-garden-help-seen");
  });

  it("should initialize with default page (home) and state", () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
      })
    );

    expect(result.current.activePage).toBe("home");
    expect(result.current.isNavOpen).toBe(false);
    expect(result.current.isHelpOpen).toBe(true);
    expect(result.current.placementBedId).toBeNull();
  });

  it("should navigate to a page and close nav", () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
        selectedGarden: 1,
      })
    );

    act(() => {
      result.current.setIsNavOpen(true);
      result.current.navigateTo("planner");
    });

    expect(result.current.activePage).toBe("planner");
    expect(result.current.isNavOpen).toBe(false);
  });

  it("should redirect to home when selectedGarden is cleared for garden-required page", () => {
    const { result, rerender } = renderHook(
      ({ selectedGarden }: { selectedGarden: number | null }) =>
        usePageRouter({
          token: "test-token",
          authFlow: mockAuthFlow,
          pushNotice: mockPushNotice,
          selectedGarden,
        }),
      { initialProps: { selectedGarden: 1 } }
    );

    act(() => {
      result.current.navigateTo("planner");
    });

    expect(result.current.activePage).toBe("planner");

    // Clear the selected garden
    rerender({ selectedGarden: null });

    expect(result.current.activePage).toBe("home");
  });

  it("should show help modal on first login if not seen before", async () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
      })
    );

    await waitFor(() => {
      expect(result.current.isHelpOpen).toBe(true);
    });
  });

  it("should manage month cursor and selected date state", () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
      })
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
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
      })
    );

    expect(result.current.placementBedId).toBeNull();

    act(() => {
      result.current.setPlacementBedId(42);
    });

    expect(result.current.placementBedId).toBe(42);
  });

  it("should not allow navigation to garden-required pages when no garden selected", async () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
        selectedGarden: null,
      })
    );

    act(() => {
      result.current.navigateTo("planner");
    });

    await waitFor(() => {
      expect(result.current.activePage).toBe("home");
    });
  });

  it("should close nav when page changes", () => {
    const { result } = renderHook(() =>
      usePageRouter({
        token: "test-token",
        authFlow: mockAuthFlow,
        pushNotice: mockPushNotice,
        selectedGarden: 1,
      })
    );

    act(() => {
      result.current.setIsNavOpen(true);
    });

    expect(result.current.isNavOpen).toBe(true);

    act(() => {
      result.current.setActivePage("calendar");
    });

    expect(result.current.isNavOpen).toBe(false);
  });
});
