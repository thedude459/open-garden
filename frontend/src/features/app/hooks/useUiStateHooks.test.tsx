import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useConfirmAction } from "./useConfirmAction";
import { useNotices } from "./useNotices";
import { usePlannerHistory } from "./usePlannerHistory";

describe("useNotices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(1000);
    vi.spyOn(Math, "random").mockReturnValue(0.123);
  });

  it("adds and dismisses notices, including timeout cleanup", () => {
    const { result } = renderHook(() => useNotices());

    act(() => {
      result.current.pushNotice("Saved", "success");
    });

    expect(result.current.notices).toHaveLength(1);
    const [{ id }] = result.current.notices;

    act(() => {
      result.current.dismissNotice(id);
    });
    expect(result.current.notices).toHaveLength(0);

    act(() => {
      result.current.pushNotice("Queued", "info");
      vi.runAllTimers();
    });

    expect(result.current.notices).toHaveLength(0);
  });
});

describe("useConfirmAction", () => {
  it("runs confirmed actions and reports failures", async () => {
    const pushNotice = vi.fn();
    const onConfirm = vi.fn(async () => undefined);
    const { result } = renderHook(() => useConfirmAction({ pushNotice }));

    act(() => {
      result.current.setConfirmState({ title: "Delete", message: "Really?", onConfirm });
    });

    await act(async () => {
      await result.current.runConfirmedAction();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.confirmState).toBeNull();
    expect(result.current.isConfirmingAction).toBe(false);

    act(() => {
      result.current.setConfirmState({ title: "Delete", message: "Really?", onConfirm: vi.fn(async () => { throw new Error("boom"); }) });
    });

    await act(async () => {
      await result.current.runConfirmedAction();
    });

    expect(pushNotice).toHaveBeenCalledWith("boom", "error");
  });
});

describe("usePlannerHistory", () => {
  it("tracks undo and redo state", async () => {
    const notify = vi.fn();
    const undo = vi.fn(async () => undefined);
    const redo = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePlannerHistory(notify));

    act(() => {
      result.current.pushPlannerHistory({ label: "Rotate bed", undo, redo });
    });

    expect(result.current.plannerUndoCount).toBe(1);
    expect(result.current.plannerRedoCount).toBe(0);

    await act(async () => {
      await result.current.undoPlannerChange();
    });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(result.current.plannerUndoCount).toBe(0);
    expect(result.current.plannerRedoCount).toBe(1);
    expect(notify).toHaveBeenCalledWith("Undo: Rotate bed.", "info");

    await act(async () => {
      await result.current.redoPlannerChange();
    });

    expect(redo).toHaveBeenCalledTimes(1);
    expect(result.current.plannerUndoCount).toBe(1);
    expect(result.current.plannerRedoCount).toBe(0);
    expect(notify).toHaveBeenCalledWith("Redo: Rotate bed.", "info");

    act(() => {
      result.current.resetPlannerHistory();
    });

    expect(result.current.plannerUndoCount).toBe(0);
    expect(result.current.plannerRedoCount).toBe(0);
  });
});