import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlannerRotationPreview } from "./usePlannerRotationPreview";
import type { Bed } from "../../types";

function makeBed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 1,
    garden_id: 1,
    name: "Test Bed",
    width_in: 48,  // 4 ft wide
    height_in: 96, // 8 ft long
    grid_x: 0,
    grid_y: 0,
    ...overrides,
  };
}

describe("usePlannerRotationPreview", () => {
  let onRotateBed: (bedId: number, autoFit?: boolean) => Promise<void>;

  beforeEach(() => {
    onRotateBed = vi.fn(async () => undefined) as unknown as typeof onRotateBed;
  });

  it("starts with no pending rotation", () => {
    const { result } = renderHook(() =>
      usePlannerRotationPreview({ beds: [], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
    );
    expect(result.current.pendingRotation).toBeNull();
    expect(result.current.isApplyingRotation).toBe(false);
  });

  describe("requestRotatePreview", () => {
    it("sets pending rotation with swapped dimensions", () => {
      // 4 ft wide × 8 ft long → rotation: 8 ft wide × 4 ft long
      const bed = makeBed({ width_in: 48, height_in: 96 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation).not.toBeNull();
      expect(result.current.pendingRotation?.rotatedWidthFt).toBe(8);
      expect(result.current.pendingRotation?.rotatedLengthFt).toBe(4);
      expect(result.current.pendingRotation?.bedId).toBe(1);
      expect(result.current.pendingRotation?.bedName).toBe("Test Bed");
    });

    it("preserves current grid position in pendingRotation", () => {
      const bed = makeBed({ grid_x: 3, grid_y: 2 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.currentX).toBe(3);
      expect(result.current.pendingRotation?.currentY).toBe(2);
    });

    it("fitsCurrent is true when rotated dims fit at original position", () => {
      // 4 ft wide × 8 ft long at (0,0) in 20×20 yard → rotated 8×4 still fits
      const bed = makeBed({ width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.fitsCurrent).toBe(true);
    });

    it("fitsCurrent is false when rotated dims overflow the yard", () => {
      // 4 ft wide × 8 ft long at x=17 in 20-wide yard → rotated 8 ft wide → 17+8=25 > 20
      const bed = makeBed({ width_in: 48, height_in: 96, grid_x: 17, grid_y: 0 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.fitsCurrent).toBe(false);
    });

    it("hasBedOverlap is false when there are no other beds", () => {
      const bed = makeBed();
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.hasBedOverlap).toBe(false);
    });

    it("hasBedOverlap is true when another bed occupies the rotated footprint", () => {
      const bed = makeBed({ id: 1, width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 });
      // Rotated: 8 ft wide × 4 ft long starting at (0,0)
      // Place another bed squarely inside that footprint
      const obstacle = makeBed({ id: 2, name: "Obstacle", width_in: 24, height_in: 24, grid_x: 2, grid_y: 1 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed, obstacle], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.hasBedOverlap).toBe(true);
    });

    it("uses minimum dimension of 1 ft for sub-12-inch beds", () => {
      const bed = makeBed({ width_in: 6, height_in: 6 });
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation?.rotatedWidthFt).toBeGreaterThanOrEqual(1);
      expect(result.current.pendingRotation?.rotatedLengthFt).toBeGreaterThanOrEqual(1);
    });
  });

  describe("confirmRotate", () => {
    it("does nothing when pendingRotation is null", async () => {
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      await act(async () => result.current.confirmRotate(false));
      expect(onRotateBed).not.toHaveBeenCalled();
    });

    it("calls onRotateBed with bedId and autoFit=true and clears pendingRotation", async () => {
      const bed = makeBed();
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      await act(async () => result.current.confirmRotate(true));
      expect(onRotateBed).toHaveBeenCalledWith(1, true);
      expect(result.current.pendingRotation).toBeNull();
      expect(result.current.isApplyingRotation).toBe(false);
    });

    it("calls onRotateBed with autoFit=false when passed false", async () => {
      const bed = makeBed();
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      await act(async () => result.current.confirmRotate(false));
      expect(onRotateBed).toHaveBeenCalledWith(1, false);
    });
  });

  describe("cancel rotation", () => {
    it("clears pendingRotation via setPendingRotation without calling onRotateBed", () => {
      const bed = makeBed();
      const { result } = renderHook(() =>
        usePlannerRotationPreview({ beds: [bed], yardWidthFt: 20, yardLengthFt: 20, onRotateBed }),
      );
      act(() => result.current.requestRotatePreview(bed));
      expect(result.current.pendingRotation).not.toBeNull();
      act(() => result.current.setPendingRotation(null));
      expect(result.current.pendingRotation).toBeNull();
      expect(onRotateBed).not.toHaveBeenCalled();
    });
  });
});
