import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Bed } from "../../types";
import type { ConfirmState, PlannerHistoryEntry } from "../types";
import { usePlannerBedActions } from "./usePlannerBedActions";

function makeBed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 10,
    garden_id: 1,
    name: "Bed A",
    width_in: 48,
    height_in: 96,
    grid_x: 0,
    grid_y: 0,
    ...overrides,
  };
}

function renderBedActions(overrides: Partial<Parameters<typeof usePlannerBedActions>[0]> = {}) {
  let beds = [makeBed()];
  let confirmState: ConfirmState | null = null;
  let historyEntry: PlannerHistoryEntry | undefined;
  const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/beds/10/position") {
      const payload = JSON.parse(String(options?.body ?? "{}"));
      return { ...beds[0], grid_x: payload.grid_x, grid_y: payload.grid_y } satisfies Bed;
    }
    if (path === "/beds/10/rotate") {
      return { ...beds[0], width_in: beds[0].height_in, height_in: beds[0].width_in } satisfies Bed;
    }
    if (path === "/beds/10") {
      const payload = JSON.parse(String(options?.body ?? "{}"));
      return { ...beds[0], name: payload.name } satisfies Bed;
    }
    return undefined;
  });
  const setBeds = vi.fn((update: Bed[] | ((prev: Bed[]) => Bed[])) => {
    beds = typeof update === "function" ? update(beds) : update;
  });
  const pushNotice = vi.fn();
  const setConfirmState = vi.fn((next: ConfirmState | null) => {
    confirmState = next;
  });
  const pushPlannerHistory = vi.fn((entry: PlannerHistoryEntry) => {
    historyEntry = entry;
  });
  const loadGardenData = vi.fn(async () => undefined);
  const loadGardens = vi.fn(async () => undefined);
  const setSelectedGarden = vi.fn();
  const setTasks = vi.fn();
  const setPlantings = vi.fn();
  const setPlacements = vi.fn();

  const hook = renderHook(() =>
    usePlannerBedActions({
      fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
      pushNotice,
      setBeds,
      beds,
      yardWidthFt: 12,
      yardLengthFt: 12,
      pushPlannerHistory,
      setConfirmState: setConfirmState as React.Dispatch<React.SetStateAction<ConfirmState | null>>,
      loadGardenData,
      loadGardens,
      setSelectedGarden,
      setTasks,
      setPlantings,
      setPlacements,
      ...overrides,
    }),
  );

  return {
    ...hook,
    fetchAuthed,
    setBeds,
    pushNotice,
    confirmStateRef: () => confirmState,
    historyEntryRef: () => historyEntry,
    loadGardenData,
    loadGardens,
    setSelectedGarden,
    setTasks,
    setPlantings,
    setPlacements,
  };
}

describe("usePlannerBedActions", () => {
  it("nudges a bed within yard bounds and records history", async () => {
    const { result, fetchAuthed, pushNotice, historyEntryRef } = renderBedActions({
      beds: [makeBed({ width_in: 48, height_in: 48, grid_x: 0, grid_y: 0 })],
    });

    await act(async () => {
      await result.current.nudgeBedByDelta(10, 2, 1);
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(historyEntryRef()?.label).toBe("Move Bed A");
    expect(pushNotice).toHaveBeenCalledWith("Moved Bed A to (3, 2).", "info");

    // undo moves bed back to origin
    await act(async () => {
      await historyEntryRef()?.undo();
    });
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ grid_x: 0, grid_y: 0 }) }),
    );

    // redo moves bed to the new position
    await act(async () => {
      await historyEntryRef()?.redo();
    });
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ grid_x: 2, grid_y: 1 }) }),
    );
  });

  it("auto-fits a bed before rotating when bounds would overflow", async () => {
    const { result, fetchAuthed, pushNotice, historyEntryRef } = renderBedActions({
      beds: [makeBed({ grid_x: 10, grid_y: 4, width_in: 48, height_in: 96 })],
      yardWidthFt: 12,
      yardLengthFt: 12,
    });

    await act(async () => {
      await result.current.rotateBedInYard(10, true);
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/rotate",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(historyEntryRef()?.label).toBe("Rotate Bed A");
    expect(pushNotice).toHaveBeenCalledWith("Rotated Bed A.", "success");

    // undo: rotate back then move to original position
    await act(async () => {
      await historyEntryRef()?.undo();
    });
    // second rotate call (undo)
    expect(fetchAuthed).toHaveBeenCalledWith("/beds/10/rotate", { method: "PATCH" });
    // move back to original position (fromX=10, fromY=4)
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ grid_x: 10, grid_y: 4 }) }),
    );

    // redo: move to auto-fit position then rotate
    await act(async () => {
      await historyEntryRef()?.redo();
    });
    // move to auto-fit position (toX=4, toY=4)
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ grid_x: 4, grid_y: 4 }) }),
    );
  });

  it("throws when a rotate would overflow without auto-fit", async () => {
    const { result, fetchAuthed, pushNotice } = renderBedActions({
      beds: [makeBed({ grid_x: 10, grid_y: 4, width_in: 48, height_in: 96 })],
      yardWidthFt: 12,
      yardLengthFt: 12,
    });

    await expect(result.current.rotateBedInYard(10, false)).rejects.toThrow(
      "Bed cannot rotate at its current position. Use Auto-fit rotate or move the bed first.",
    );

    expect(fetchAuthed).not.toHaveBeenCalledWith(
      "/beds/10/rotate",
      expect.anything(),
    );
    expect(pushNotice).toHaveBeenCalledWith(
      "Bed cannot rotate at its current position. Use Auto-fit rotate or move the bed first.",
      "error",
    );
  });

  it("clamps rotated bed position when rotate response is out of bounds", async () => {
    const bed = makeBed({ width_in: 96, height_in: 48, grid_x: 7, grid_y: 1 });
    const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/beds/10/rotate") {
        return {
          ...bed,
          width_in: 48,
          height_in: 96,
          grid_x: 11,
          grid_y: 1,
        } satisfies Bed;
      }
      if (path === "/beds/10/position") {
        const payload = JSON.parse(String(options?.body ?? "{}"));
        return {
          ...bed,
          width_in: 48,
          height_in: 96,
          grid_x: payload.grid_x,
          grid_y: payload.grid_y,
        } satisfies Bed;
      }
      return undefined;
    });
    const setBeds = vi.fn();
    const pushNotice = vi.fn();
    const pushPlannerHistory = vi.fn();

    const { result } = renderHook(() =>
      usePlannerBedActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setBeds,
        beds: [bed],
        yardWidthFt: 12,
        yardLengthFt: 12,
        pushPlannerHistory,
        setConfirmState: vi.fn() as React.Dispatch<React.SetStateAction<ConfirmState | null>>,
        loadGardenData: vi.fn(async () => undefined),
        loadGardens: vi.fn(async () => undefined),
        setSelectedGarden: vi.fn(),
        setTasks: vi.fn(),
        setPlantings: vi.fn(),
        setPlacements: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.rotateBedInYard(10, false);
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10/position",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ grid_x: 8, grid_y: 1 }) }),
    );
    expect(pushNotice).toHaveBeenCalledWith("Rotated Bed A.", "success");
  });

  it("configures delete bed confirmation and runs the delete callback", async () => {
    const { result, confirmStateRef, fetchAuthed, loadGardenData, pushNotice } = renderBedActions();

    await act(async () => {
      await result.current.deleteBed(10);
    });

    const confirmState = confirmStateRef();
    expect(confirmState?.title).toBe("Delete bed?");

    await act(async () => {
      await confirmState?.onConfirm();
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/beds/10", { method: "DELETE" });
    expect(loadGardenData).toHaveBeenCalledTimes(1);
    expect(pushNotice).toHaveBeenCalledWith("Bed deleted.", "info");
  });

  it("renames a bed and records rename history", async () => {
    const { result, fetchAuthed, pushNotice, historyEntryRef } = renderBedActions();

    await act(async () => {
      await result.current.renameBed(10, "Kitchen Bed");
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Kitchen Bed" }) }),
    );
    expect(pushNotice).toHaveBeenCalledWith("Renamed bed to Kitchen Bed.", "success");
    expect(historyEntryRef()?.label).toBe("Rename Bed A");

    await act(async () => {
      await historyEntryRef()?.undo();
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/beds/10",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Bed A" }) }),
    );
  });

  it("rejects blank rename input", async () => {
    const { result, fetchAuthed, pushNotice } = renderBedActions();

    await act(async () => {
      await result.current.renameBed(10, "   ");
    });

    expect(fetchAuthed).not.toHaveBeenCalledWith("/beds/10", expect.anything());
    expect(pushNotice).toHaveBeenCalledWith("Bed name cannot be empty.", "error");
  });

  it("configures delete garden confirmation and clears local state on confirm", async () => {
    const {
      result,
      confirmStateRef,
      fetchAuthed,
      loadGardens,
      setSelectedGarden,
      setBeds,
      setTasks,
      setPlantings,
      setPlacements,
      pushNotice,
    } = renderBedActions();

    await act(async () => {
      await result.current.deleteGarden(1);
    });

    const confirmState = confirmStateRef();
    expect(confirmState?.title).toBe("Delete garden?");

    await act(async () => {
      await confirmState?.onConfirm();
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/gardens/1", { method: "DELETE" });
    expect(setSelectedGarden).toHaveBeenCalledWith(null);
    expect(setBeds).toHaveBeenCalledWith([]);
    expect(setTasks).toHaveBeenCalledWith([]);
    expect(setPlantings).toHaveBeenCalledWith([]);
    expect(setPlacements).toHaveBeenCalledWith([]);
    expect(loadGardens).toHaveBeenCalledTimes(1);
    expect(pushNotice).toHaveBeenCalledWith("Garden deleted.", "info");
  });
});