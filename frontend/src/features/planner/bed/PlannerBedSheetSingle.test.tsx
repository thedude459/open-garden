import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerBedSheetSingle } from "./PlannerBedSheetSingle";
import type { Bed, Placement } from "../../types";

const sampleBed: Bed = {
  id: 1,
  garden_id: 1,
  name: "Raised Bed A",
  width_in: 12, // 4 cols (12/3)
  height_in: 12, // 4 rows
  grid_x: 0,
  grid_y: 0,
};

const samplePlacement: Placement = {
  id: 10,
  garden_id: 1,
  bed_id: 1,
  crop_name: "Tomato",
  grid_x: 0,
  grid_y: 0,
  color: "#e53935",
  planted_on: "2026-04-01",
};

function defaultProps(overrides: Partial<Parameters<typeof PlannerBedSheetSingle>[0]> = {}) {
  return {
    bed: sampleBed,
    placements: [],
    selectedCropName: "",
    selectedPlacement: null,
    setSelectedPlacementId: vi.fn(),
    bulkMode: false,
    selectedPlacementIds: [],
    togglePlacementSelection: vi.fn(),
    startLasso: vi.fn(),
    updateLasso: vi.fn(),
    finishLasso: vi.fn(),
    onBlockedPlacementMove: vi.fn(),
    placementSpacingConflict: vi.fn().mockReturnValue(null),
    onMovePlacement: vi.fn(),
    onAddPlacement: vi.fn(),
    isCellBlockedForSelectedCrop: vi.fn().mockReturnValue(false),
    isCellInBuffer: vi.fn().mockReturnValue(false),
    cropVisual: vi.fn().mockReturnValue({ imageUrl: "/img.png", rowSpacingIn: 12, inRowSpacingIn: 6 }),
    onNudgePlacement: vi.fn(),
    onRequestRemovePlacement: vi.fn(),
    requestRotatePreview: vi.fn(),
    onRenameBed: vi.fn().mockResolvedValue(undefined),
    onDeleteBed: vi.fn(),
    allPlacements: [],
    ...overrides,
  };
}

describe("PlannerBedSheetSingle", () => {
  it("renders bed name in header", () => {
    render(<PlannerBedSheetSingle {...defaultProps()} />);
    expect(screen.getByText("Raised Bed A")).toBeInTheDocument();
  });

  it("shows 'No crop placements yet.' when placements is empty", () => {
    render(<PlannerBedSheetSingle {...defaultProps()} />);
    expect(screen.getByText(/no crop placements yet/i)).toBeInTheDocument();
  });

  it("calls requestRotatePreview when Rotate 90° is clicked", () => {
    const requestRotatePreview = vi.fn();
    render(<PlannerBedSheetSingle {...defaultProps({ requestRotatePreview })} />);
    fireEvent.click(screen.getByRole("button", { name: /rotate 90/i }));
    expect(requestRotatePreview).toHaveBeenCalledWith(sampleBed);
  });

  it("calls onDeleteBed when Delete bed is clicked", () => {
    const onDeleteBed = vi.fn();
    render(<PlannerBedSheetSingle {...defaultProps({ onDeleteBed })} />);
    fireEvent.click(screen.getByRole("button", { name: /delete bed/i }));
    expect(onDeleteBed).toHaveBeenCalledWith(1);
  });

  it("shows rename form when Rename is clicked, updates draft, saves on submit", async () => {
    const onRenameBed = vi.fn().mockResolvedValue(undefined);
    render(<PlannerBedSheetSingle {...defaultProps({ onRenameBed })} />);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /rename raised bed a/i });
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(onRenameBed).toHaveBeenCalledWith(1, "New Name"));
  });

  it("cancels rename when Cancel is clicked", () => {
    render(<PlannerBedSheetSingle {...defaultProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(screen.getByRole("textbox", { name: /rename raised bed a/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Raised Bed A")).toBeInTheDocument();
  });

  it("calls onAddPlacement when an empty cell is clicked with no selected placement", () => {
    const onAddPlacement = vi.fn();
    render(<PlannerBedSheetSingle {...defaultProps({ onAddPlacement, selectedCropName: "Tomato" })} />);
    fireEvent.click(screen.getByRole("button", { name: /empty square column 1, row 1/i }));
    expect(onAddPlacement).toHaveBeenCalledWith(1, 0, 0);
  });

  it("calls onMovePlacement when an empty cell is clicked with a selected placement", () => {
    const onMovePlacement = vi.fn();
    const setSelectedPlacementId = vi.fn();
    render(
      <PlannerBedSheetSingle
        {...defaultProps({ onMovePlacement, setSelectedPlacementId, selectedPlacement: samplePlacement, placements: [samplePlacement] })}
      />,
    );
    // Click on a different empty cell (col 2, row 1 → x=1, y=0)
    fireEvent.click(screen.getByRole("button", { name: /empty square column 2, row 1/i }));
    expect(onMovePlacement).toHaveBeenCalledWith(10, 1, 1, 0);
  });

  it("renders crop placement chips and legend entries", () => {
    render(<PlannerBedSheetSingle {...defaultProps({ placements: [samplePlacement] })} />);
    // The placement chip button has the extended aria-label with "Arrow keys move"
    expect(screen.getByRole("button", { name: /arrow keys move/i })).toBeInTheDocument();
    // Legend should show crop name
    expect(screen.getByText(/Tomato \(1\)/)).toBeInTheDocument();
  });

  it("calls onNudgePlacement on arrow key press on placement chip", () => {
    const onNudgePlacement = vi.fn();
    render(<PlannerBedSheetSingle {...defaultProps({ placements: [samplePlacement], onNudgePlacement })} />);
    const chip = screen.getByRole("button", { name: /arrow keys move/i });
    fireEvent.keyDown(chip, { key: "ArrowLeft" });
    expect(onNudgePlacement).toHaveBeenCalledWith(10, -1, 0);
    fireEvent.keyDown(chip, { key: "ArrowRight" });
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 1, 0);
    fireEvent.keyDown(chip, { key: "ArrowUp" });
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 0, -1);
    fireEvent.keyDown(chip, { key: "ArrowDown" });
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 0, 1);
  });

  it("calls onRequestRemovePlacement when Remove button is clicked", () => {
    const onRequestRemovePlacement = vi.fn();
    render(
      <PlannerBedSheetSingle
        {...defaultProps({ placements: [samplePlacement], onRequestRemovePlacement })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRequestRemovePlacement).toHaveBeenCalledWith(10, "Tomato");
  });

  it("calls onNudgePlacement with correct direction for nudge buttons in placement row", () => {
    const onNudgePlacement = vi.fn();
    render(<PlannerBedSheetSingle {...defaultProps({ placements: [samplePlacement], onNudgePlacement })} />);
    fireEvent.click(screen.getByRole("button", { name: /move tomato left/i }));
    expect(onNudgePlacement).toHaveBeenCalledWith(10, -1, 0);
    fireEvent.click(screen.getByRole("button", { name: /move tomato up/i }));
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 0, -1);
    fireEvent.click(screen.getByRole("button", { name: /move tomato down/i }));
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 0, 1);
    fireEvent.click(screen.getByRole("button", { name: /move tomato right/i }));
    expect(onNudgePlacement).toHaveBeenCalledWith(10, 1, 0);
  });

  it("toggles placement selection in bulkMode when chip is clicked", () => {
    const togglePlacementSelection = vi.fn();
    render(
      <PlannerBedSheetSingle
        {...defaultProps({ placements: [samplePlacement], bulkMode: true, togglePlacementSelection })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /arrow keys move/i }));
    expect(togglePlacementSelection).toHaveBeenCalledWith(10);
  });

  it("calls togglePlacementSelection when occupied cell clicked in bulkMode", () => {
    const togglePlacementSelection = vi.fn();
    render(
      <PlannerBedSheetSingle
        {...defaultProps({ placements: [samplePlacement], bulkMode: true, togglePlacementSelection })}
      />,
    );
    // In bulkMode, clicking the occupied grid cell (not the placement chip) should toggle selection
    fireEvent.click(screen.getByRole("button", { name: /tomato at column 1, row 1$/i }));
    expect(togglePlacementSelection).toHaveBeenCalledWith(10);
  });
});
