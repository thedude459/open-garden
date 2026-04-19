import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Bed, Placement } from "../../types";
import type { PlannerHistoryEntry } from "../types";
import { usePlannerPlacementActions } from "./usePlannerPlacementActions";

function makeBed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 10,
    garden_id: 1,
    name: "Bed A",
    width_in: 48,
    height_in: 48,
    grid_x: 0,
    grid_y: 0,
    ...overrides,
  };
}

function makePlacement(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 1,
    garden_id: 1,
    bed_id: 10,
    crop_name: "Tomato",
    grid_x: 1,
    grid_y: 1,
    planted_on: "2026-04-01",
    expected_harvest_on: "2026-07-01",
    color: "#f00",
    method: "direct_seed",
    location: "in_bed",
    moved_on: null,
    source: "",
    harvested_on: null,
    yield_notes: "",
    ...overrides,
  };
}

describe("usePlannerPlacementActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks placement creation when spacing rules fail", async () => {
    const fetchAuthed = vi.fn();
    const pushNotice = vi.fn();
    const pushPlannerHistory = vi.fn();
    let placements = [makePlacement()];
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "Tomato",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => "Too close to another crop",
        pushPlannerHistory,
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.addPlacement(10, 2, 2);
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
    expect(pushPlannerHistory).not.toHaveBeenCalled();
    expect(pushNotice).toHaveBeenCalledWith("Too close to another crop", "error");
  });

  it("creates placements and wires undo redo history", async () => {
    let nextId = 2;
    let placements = [makePlacement()];
    const pushNotice = vi.fn();
    let historyEntry: PlannerHistoryEntry | undefined;
    const pushPlannerHistory = vi.fn((entry: PlannerHistoryEntry) => {
      historyEntry = entry;
    });
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });
    const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/plantings") {
        const payload = JSON.parse(String(options?.body ?? "{}"));
        return {
          id: nextId++,
          expected_harvest_on: "2026-07-01",
          moved_on: null,
          source: "",
          harvested_on: null,
          yield_notes: "",
          ...payload,
        } satisfies Placement;
      }
      if (path.startsWith("/plantings/") && options?.method === "DELETE") {
        return undefined;
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "Tomato",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.addPlacement(10, 2, 2);
    });

    expect(placements).toHaveLength(2);
    expect(historyEntry?.label).toBe("Add Tomato");
    expect(pushNotice).toHaveBeenCalledWith("Placement added to bed sheet.", "success");

    await act(async () => {
      await historyEntry?.undo();
      await historyEntry?.redo();
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/plantings/2", { method: "DELETE" });
    expect(fetchAuthed).toHaveBeenCalledWith(
      "/plantings",
      expect.objectContaining({ method: "POST" }),
    );
    expect(placements).toHaveLength(2);
  });

  it("moves a placement and records history", async () => {
    let placements = [makePlacement({ id: 4, grid_x: 1, grid_y: 1 })];
    let historyEntry: PlannerHistoryEntry | undefined;
    const pushPlannerHistory = vi.fn((entry: PlannerHistoryEntry) => {
      historyEntry = entry;
    });
    const pushNotice = vi.fn();
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });
    const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/plantings/4/move") {
        const payload = JSON.parse(String(options?.body ?? "{}"));
        return { ...placements[0], bed_id: payload.bed_id, grid_x: payload.grid_x, grid_y: payload.grid_y } satisfies Placement;
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "Tomato",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.movePlacement(4, 10, 3, 2);
    });

    expect(placements[0].grid_x).toBe(3);
    expect(placements[0].grid_y).toBe(2);
    expect(historyEntry?.label).toBe("Move Tomato");
    expect(pushNotice).toHaveBeenCalledWith("Placement moved.", "success");

    await act(async () => {
      await historyEntry?.undo();
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/plantings/4/move",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("rejects bulk moves across multiple beds", async () => {
    const fetchAuthed = vi.fn();
    const pushNotice = vi.fn();
    const pushPlannerHistory = vi.fn();
    let placements = [makePlacement({ id: 1, bed_id: 10 }), makePlacement({ id: 2, bed_id: 11 })];
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed({ id: 10 }), makeBed({ id: 11 })],
        selectedGarden: 1,
        selectedCropName: "Tomato",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.movePlacementsByDelta([1, 2], 1, 0);
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
    expect(pushPlannerHistory).not.toHaveBeenCalled();
    expect(pushNotice).toHaveBeenCalledWith(
      "Bulk move currently supports selections in one bed at a time.",
      "error",
    );
  });

  it("skips addPlacement when selectedCropName is empty", async () => {
    const fetchAuthed = vi.fn();
    const pushNotice = vi.fn();
    const pushPlannerHistory = vi.fn();
    let placements: Placement[] = [];
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "   ",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.addPlacement(10, 0, 0);
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
    expect(pushPlannerHistory).not.toHaveBeenCalled();
    expect(pushNotice).not.toHaveBeenCalled();
  });

  it("removes a placement and wires undo redo history", async () => {
    let nextId = 10;
    let placements = [makePlacement({ id: 5, crop_name: "Basil", bed_id: 10, grid_x: 2, grid_y: 3 })];
    let historyEntry: PlannerHistoryEntry | undefined;
    const pushPlannerHistory = vi.fn((entry: PlannerHistoryEntry) => {
      historyEntry = entry;
    });
    const pushNotice = vi.fn();
    const refreshTasks = vi.fn(async () => undefined);
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });
    const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/plantings") {
        const payload = JSON.parse(String(options?.body ?? "{}"));
        return {
          id: nextId++,
          expected_harvest_on: "2026-07-01",
          moved_on: null,
          source: "",
          harvested_on: null,
          yield_notes: "",
          ...payload,
        } satisfies Placement;
      }
      if (path.startsWith("/plantings/") && options?.method === "DELETE") {
        return undefined;
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "Basil",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks,
      }),
    );

    await act(async () => {
      await result.current.removePlacement(5);
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/plantings/5", { method: "DELETE" });
    expect(refreshTasks).toHaveBeenCalledTimes(1);
    expect(placements).toHaveLength(0);
    expect(historyEntry?.label).toBe("Remove Basil");
    expect(pushNotice).toHaveBeenCalledWith("Placement removed.", "info");

    // undo recreates the placement
    await act(async () => {
      await historyEntry?.undo();
    });
    expect(fetchAuthed).toHaveBeenCalledWith("/plantings", expect.objectContaining({ method: "POST" }));
    expect(placements).toHaveLength(1);

    // redo deletes the recreated placement
    const recreatedId = placements[0].id;
    await act(async () => {
      await historyEntry?.redo();
    });
    expect(fetchAuthed).toHaveBeenCalledWith(`/plantings/${recreatedId}`, { method: "DELETE" });
    expect(placements).toHaveLength(0);
  });

  it("removes placements in bulk and wires undo redo history", async () => {
    let nextId = 20;
    let placements = [
      makePlacement({ id: 7, crop_name: "Carrot", bed_id: 10, grid_x: 0, grid_y: 0 }),
      makePlacement({ id: 8, crop_name: "Carrot", bed_id: 10, grid_x: 1, grid_y: 0 }),
    ];
    let historyEntry: PlannerHistoryEntry | undefined;
    const pushPlannerHistory = vi.fn((entry: PlannerHistoryEntry) => {
      historyEntry = entry;
    });
    const pushNotice = vi.fn();
    const refreshTasks = vi.fn(async () => undefined);
    const setPlacements = vi.fn((update: Placement[] | ((prev: Placement[]) => Placement[])) => {
      placements = typeof update === "function" ? update(placements) : update;
    });
    const fetchAuthed = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/plantings") {
        const payload = JSON.parse(String(options?.body ?? "{}"));
        return {
          id: nextId++,
          expected_harvest_on: "2026-07-01",
          moved_on: null,
          source: "",
          harvested_on: null,
          yield_notes: "",
          ...payload,
        } satisfies Placement;
      }
      if (path.startsWith("/plantings/") && options?.method === "DELETE") {
        return undefined;
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() =>
      usePlannerPlacementActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        setPlacements,
        placements,
        beds: [makeBed()],
        selectedGarden: 1,
        selectedCropName: "Carrot",
        selectedDate: "2026-04-01",
        placementSpacingConflict: () => null,
        pushPlannerHistory,
        refreshTasks,
      }),
    );

    await act(async () => {
      await result.current.removePlacementsBulk([7, 8]);
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/plantings/7", { method: "DELETE" });
    expect(fetchAuthed).toHaveBeenCalledWith("/plantings/8", { method: "DELETE" });
    expect(placements).toHaveLength(0);
    expect(historyEntry?.label).toBe("Remove 2 placements");
    expect(pushNotice).toHaveBeenCalledWith("Removed 2 placements.", "info");
    expect(refreshTasks).toHaveBeenCalledTimes(1);

    // undo recreates both placements
    await act(async () => {
      await historyEntry?.undo();
    });
    expect(placements).toHaveLength(2);
    expect(fetchAuthed).toHaveBeenCalledTimes(4); // 2 deletes + 2 recreates

    // redo deletes them again
    const ids = placements.map((p) => p.id);
    await act(async () => {
      await historyEntry?.redo();
    });
    expect(fetchAuthed).toHaveBeenCalledWith(`/plantings/${ids[0]}`, { method: "DELETE" });
    expect(fetchAuthed).toHaveBeenCalledWith(`/plantings/${ids[1]}`, { method: "DELETE" });
    expect(placements).toHaveLength(0);
  });
});