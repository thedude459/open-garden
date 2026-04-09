import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerYardCanvas } from "./PlannerYardCanvas";
import type { Bed } from "../../types";

const sampleBed: Bed = {
  id: 1,
  garden_id: 1,
  name: "Raised Bed A",
  width_in: 48,
  height_in: 96,
  grid_x: 0,
  grid_y: 0,
};

function defaultProps(overrides: Partial<Parameters<typeof PlannerYardCanvas>[0]> = {}) {
  return {
    yardGridRef: createRef<HTMLDivElement>(),
    yardWidthFt: 20,
    yardLengthFt: 30,
    yardCellPx: 24,
    selectedBedId: null,
    beds: [],
    placementBedId: null,
    resolveBedGridPosition: vi.fn().mockReturnValue(null),
    onMoveBedInYard: vi.fn(),
    onNudgeBed: vi.fn(),
    requestRotatePreview: vi.fn(),
    showSunOverlay: false,
    showShadeOverlay: false,
    showGrowthPreview: false,
    sunExposure: [],
    shadeMap: [],
    canopyPreview: [],
    growthDayOffset: 0,
    pendingRotation: null,
    ...overrides,
  };
}

describe("PlannerYardCanvas", () => {
  it("shows empty-state guidance when there are no beds", () => {
    render(<PlannerYardCanvas {...defaultProps()} />);
    expect(screen.getByText(/no beds in the yard yet/i)).toBeInTheDocument();
  });

  it("does not show the empty-state when beds exist", () => {
    render(<PlannerYardCanvas {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.queryByText(/no beds in the yard yet/i)).not.toBeInTheDocument();
  });

  it("renders a bed tile when beds are provided", () => {
    render(<PlannerYardCanvas {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.getByRole("button", { name: /raised bed a/i })).toBeInTheDocument();
  });

  it("does not render sun overlay when showSunOverlay is false", () => {
    const sunExposure = [{ x: 0, y: 0, exposure: 0.8 }];
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ sunExposure, showSunOverlay: false })} />,
    );
    expect(container.querySelector(".yard-overlay-cell.sun")).not.toBeInTheDocument();
  });

  it("renders sun overlay cells when showSunOverlay is true", () => {
    const sunExposure = [{ x: 0, y: 0, exposure: 0.8 }, { x: 1, y: 0, exposure: 0.5 }];
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ sunExposure, showSunOverlay: true })} />,
    );
    expect(container.querySelectorAll(".yard-overlay-cell.sun")).toHaveLength(2);
  });

  it("renders shade overlay cells when showShadeOverlay is true", () => {
    const shadeMap = [{ x: 0, y: 0, shade: 0.4 }];
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ shadeMap, showShadeOverlay: true })} />,
    );
    expect(container.querySelectorAll(".yard-overlay-cell.shade")).toHaveLength(1);
  });

  it("renders a pending rotation ghost when pendingRotation is provided", () => {
    const pendingRotation = {
      bedId: 1,
      bedName: "Raised Bed A",
      currentX: 0,
      currentY: 0,
      currentWidthFt: 4,
      currentLengthFt: 8,
      previewX: 0,
      previewY: 0,
      rotatedWidthFt: 8,
      rotatedLengthFt: 4,
      fitsCurrent: true,
      hasBedOverlap: false,
    };
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ pendingRotation })} />,
    );
    expect(container.querySelector(".yard-bed.ghost")).toBeInTheDocument();
  });

  it("applies conflict class to rotation ghost when it does not fit", () => {
    const pendingRotation = {
      bedId: 1,
      bedName: "Raised Bed A",
      currentX: 0,
      currentY: 0,
      currentWidthFt: 4,
      currentLengthFt: 8,
      previewX: 16,
      previewY: 0,
      rotatedWidthFt: 8,
      rotatedLengthFt: 4,
      fitsCurrent: false,
      hasBedOverlap: true,
    };
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ pendingRotation })} />,
    );
    expect(container.querySelector(".yard-bed.ghost.conflict")).toBeInTheDocument();
  });

  it("renders canopy preview circles when showGrowthPreview is true", () => {
    const canopyPreview = [
      { placementId: 1, cropName: "Tomato", centerXFt: 2, centerYFt: 3, radiusFt: 1, progress: 0.5 },
    ];
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ showGrowthPreview: true, canopyPreview, growthDayOffset: 30 })} />,
    );
    expect(container.querySelector(".yard-canopy")).toBeInTheDocument();
  });

  it("does not render canopy layer when showGrowthPreview is false", () => {
    const canopyPreview = [
      { placementId: 1, cropName: "Tomato", centerXFt: 2, centerYFt: 3, radiusFt: 1, progress: 0.5 },
    ];
    const { container } = render(
      <PlannerYardCanvas {...defaultProps({ showGrowthPreview: false, canopyPreview })} />,
    );
    expect(container.querySelector(".yard-canopy")).not.toBeInTheDocument();
  });

  it("calls onNudgeBed with correct deltas on arrow key press", () => {
    const onNudgeBed = vi.fn();
    render(<PlannerYardCanvas {...defaultProps({ beds: [sampleBed], onNudgeBed })} />);
    const bedBtn = screen.getByRole("button", { name: /raised bed a/i });
    fireEvent.keyDown(bedBtn, { key: "ArrowLeft" });
    expect(onNudgeBed).toHaveBeenCalledWith(1, -1, 0);
    fireEvent.keyDown(bedBtn, { key: "ArrowRight" });
    expect(onNudgeBed).toHaveBeenCalledWith(1, 1, 0);
    fireEvent.keyDown(bedBtn, { key: "ArrowUp" });
    expect(onNudgeBed).toHaveBeenCalledWith(1, 0, -1);
    fireEvent.keyDown(bedBtn, { key: "ArrowDown" });
    expect(onNudgeBed).toHaveBeenCalledWith(1, 0, 1);
  });

  it("calls requestRotatePreview on 'r' key press", () => {
    const requestRotatePreview = vi.fn();
    render(<PlannerYardCanvas {...defaultProps({ beds: [sampleBed], requestRotatePreview })} />);
    const bedBtn = screen.getByRole("button", { name: /raised bed a/i });
    fireEvent.keyDown(bedBtn, { key: "r" });
    expect(requestRotatePreview).toHaveBeenCalledWith(sampleBed);
  });
});
