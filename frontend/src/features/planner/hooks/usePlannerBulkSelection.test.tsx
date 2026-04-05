import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlannerBulkSelection } from "./usePlannerBulkSelection";
import { Placement } from "../../types";

const placements: Placement[] = [
  {
    id: 1,
    garden_id: 1,
    bed_id: 10,
    crop_name: "Tomato",
    grid_x: 0,
    grid_y: 0,
    planted_on: "2026-04-01",
    color: "#f00",
  },
  {
    id: 2,
    garden_id: 1,
    bed_id: 10,
    crop_name: "Basil",
    grid_x: 1,
    grid_y: 1,
    planted_on: "2026-04-01",
    color: "#0f0",
  },
];

describe("usePlannerBulkSelection", () => {
  it("toggles bulk mode and clears focused placement on entry", () => {
    const clearFocusedPlacement = vi.fn();
    const { result } = renderHook(() => usePlannerBulkSelection(placements, clearFocusedPlacement));

    expect(result.current.bulkMode).toBe(false);

    act(() => {
      result.current.toggleBulkMode();
    });

    expect(result.current.bulkMode).toBe(true);
    expect(clearFocusedPlacement).toHaveBeenCalledTimes(1);
  });

  it("supports lasso selection and append selection", () => {
    const { result } = renderHook(() => usePlannerBulkSelection(placements, vi.fn()));

    act(() => {
      result.current.toggleBulkMode();
    });

    act(() => {
      result.current.startLasso(10, 0, 0);
    });

    act(() => {
      result.current.updateLasso(10, 1, 1);
    });

    act(() => {
      result.current.finishLasso(false);
    });

    expect(result.current.selectedPlacementIds).toEqual([1, 2]);

    act(() => {
      result.current.togglePlacementSelection(2);
    });

    expect(result.current.selectedPlacementIds).toEqual([1]);

    act(() => {
      result.current.startLasso(10, 1, 1);
    });

    act(() => {
      result.current.updateLasso(10, 1, 1);
    });

    act(() => {
      result.current.finishLasso(true);
    });

    expect(result.current.selectedPlacementIds).toEqual([1, 2]);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedPlacementIds).toEqual([]);
  });
});
