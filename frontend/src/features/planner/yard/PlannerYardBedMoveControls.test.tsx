import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerYardBedMoveControls } from "./PlannerYardBedMoveControls";
import type { Bed } from "../../types";

const bedA: Bed = { id: 1, garden_id: 1, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 };
const bedB: Bed = { id: 2, garden_id: 1, name: "Bed B", width_in: 36, height_in: 72, grid_x: 4, grid_y: 0 };

function defaultProps(overrides: Partial<Parameters<typeof PlannerYardBedMoveControls>[0]> = {}) {
  return {
    beds: [bedA],
    selectedBedId: null,
    setSelectedBedId: vi.fn(),
    onNudgeBed: vi.fn(),
    requestRotatePreview: vi.fn(),
    pendingRotation: null,
    ...overrides,
  };
}

describe("PlannerYardBedMoveControls", () => {
  it("renders a select button for each bed", () => {
    render(<PlannerYardBedMoveControls {...defaultProps({ beds: [bedA, bedB] })} />);
    expect(screen.getByRole("button", { name: /select bed a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select bed b/i })).toBeInTheDocument();
  });

  it("shows 'Placing: {name}' when the bed is selected", () => {
    render(<PlannerYardBedMoveControls {...defaultProps({ selectedBedId: 1 })} />);
    expect(screen.getByRole("button", { name: /placing: bed a/i })).toBeInTheDocument();
  });

  it("calls setSelectedBedId when the select button is clicked", () => {
    const setSelectedBedId = vi.fn();
    render(<PlannerYardBedMoveControls {...defaultProps({ setSelectedBedId })} />);
    fireEvent.click(screen.getByRole("button", { name: /select bed a/i }));
    expect(setSelectedBedId).toHaveBeenCalledTimes(1);
  });

  it("calls onNudgeBed with correct dy when the up arrow is clicked", () => {
    const onNudgeBed = vi.fn();
    render(<PlannerYardBedMoveControls {...defaultProps({ onNudgeBed })} />);
    fireEvent.click(screen.getByRole("button", { name: /move bed a up/i }));
    expect(onNudgeBed).toHaveBeenCalledWith(1, 0, -1);
  });

  it("calls onNudgeBed with correct dx when the right arrow is clicked", () => {
    const onNudgeBed = vi.fn();
    render(<PlannerYardBedMoveControls {...defaultProps({ onNudgeBed })} />);
    fireEvent.click(screen.getByRole("button", { name: /move bed a right/i }));
    expect(onNudgeBed).toHaveBeenCalledWith(1, 1, 0);
  });

  it("calls requestRotatePreview when the rotate button is clicked", () => {
    const requestRotatePreview = vi.fn();
    render(<PlannerYardBedMoveControls {...defaultProps({ requestRotatePreview })} />);
    fireEvent.click(screen.getByRole("button", { name: /rotate bed a/i }));
    expect(requestRotatePreview).toHaveBeenCalledWith(bedA);
  });

  it("disables the rotate button when pendingRotation is non-null", () => {
    const pendingRotation = { bedId: 1, currentX: 0, currentY: 0, currentWidthFt: 4, currentLengthFt: 8, previewX: 0, previewY: 0, rotatedWidthFt: 8, rotatedLengthFt: 4, fitsCurrent: true, hasBedOverlap: false };
    render(<PlannerYardBedMoveControls {...defaultProps({ pendingRotation })} />);
    expect(screen.getByRole("button", { name: /rotate bed a/i })).toBeDisabled();
  });

  it("renders no controls when beds is empty", () => {
    render(<PlannerYardBedMoveControls {...defaultProps({ beds: [] })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
