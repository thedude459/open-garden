import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCoachState } from "./useCoachState";

describe("useCoachState", () => {
  it("asks coach and appends user/coach messages", async () => {
    const fetchAuthed = vi.fn(async () => ({ reply: "Water less", actions: [] })) as unknown as <T = unknown>(
      path: string,
      options?: RequestInit,
    ) => Promise<T>;

    const { result } = renderHook(() =>
      useCoachState({
        fetchAuthed,
        selectedGardenRecord: { id: 7 } as never,
      }),
    );

    act(() => {
      result.current.setCoachDraftMessage("hello");
    });

    await act(async () => {
      await result.current.askCoach("Need advice", result.current.coachScenario);
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/ai/coach",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.coachMessages.length).toBe(2);
    expect(result.current.coachLatestResponse?.reply).toBe("Water less");

    act(() => {
      result.current.resetCoach();
    });
    expect(result.current.coachMessages).toEqual([]);
    expect(result.current.coachLatestResponse).toBeNull();
  });

  it("no-ops when garden or message is missing", async () => {
    const fetchAuthed = vi.fn() as unknown as <T = unknown>(
      path: string,
      options?: RequestInit,
    ) => Promise<T>;
    const { result } = renderHook(() =>
      useCoachState({
        fetchAuthed,
        selectedGardenRecord: undefined,
      }),
    );

    await act(async () => {
      await result.current.askCoach("   ", result.current.coachScenario);
      await result.current.askCoach("Need help", result.current.coachScenario);
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
  });
});
