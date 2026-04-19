import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerBedSheetsSection } from "./PlannerBedSheetsSection";
import type { Bed, Placement } from "../../types";

vi.mock("./PlannerBedSheetSingle", () => ({
  PlannerBedSheetSingle: ({ bed }: { bed: Bed }) => (
    <div data-testid={`bed-sheet-${bed.id}`}>{bed.name}</div>
  ),
}));

const sampleBed: Bed = {
  id: 1,
  garden_id: 1,
  name: "Raised Bed A",
  width_in: 48,
  height_in: 96,
  grid_x: 0,
  grid_y: 0,
};

const samplePlacement: Placement = {
  id: 1,
  garden_id: 1,
  bed_id: 1,
  crop_name: "Tomato",
  grid_x: 0,
  grid_y: 0,
  color: "#4caf50",
  planted_on: "2026-04-01",
  expected_harvest_on: "2026-07-01",
  method: "direct_seed",
  location: "in_bed",
  moved_on: null,
  source: "",
  harvested_on: null,
  yield_notes: "",
};

function defaultProps(overrides: Partial<Parameters<typeof PlannerBedSheetsSection>[0]> = {}) {
  return {
    beds: [],
    placements: [],
    selectedCropName: "",
    selectedPlacement: null,
    setSelectedPlacementId: vi.fn(),
    bulkMode: false,
    selectedPlacementIds: [],
    toggleBulkMode: vi.fn(),
    clearSelection: vi.fn(),
    togglePlacementSelection: vi.fn(),
    startLasso: vi.fn(),
    updateLasso: vi.fn(),
    finishLasso: vi.fn(),
    onBulkMovePlacements: vi.fn(),
    onBulkRemovePlacements: vi.fn(),
    onRenameBed: vi.fn(),
    onBlockedPlacementMove: vi.fn(),
    placementSpacingConflict: vi.fn().mockReturnValue(null),
    onMovePlacement: vi.fn(),
    onAddPlacement: vi.fn(),
    isCellBlockedForSelectedCrop: vi.fn().mockReturnValue(false),
    isCellInBuffer: vi.fn().mockReturnValue(false),
    cropVisual: vi.fn().mockReturnValue({ imageUrl: "", rowSpacingIn: 12, inRowSpacingIn: 12 }),
    onNudgePlacement: vi.fn(),
    onRequestRemovePlacement: vi.fn(),
    onRelocatePlanting: vi.fn(),
    onUpdatePlantingDates: vi.fn(),
    ...overrides,
  };
}

describe("PlannerBedSheetsSection", () => {
  it("shows empty-state guidance when there are no beds", () => {
    render(<PlannerBedSheetsSection {...defaultProps()} />);
    expect(screen.getByText(/create your first bed/i)).toBeInTheDocument();
  });

  it("does not show bed sheet grids when empty", () => {
    render(<PlannerBedSheetsSection {...defaultProps()} />);
    expect(screen.queryByTestId("bed-sheet-1")).not.toBeInTheDocument();
  });

  it("does not show bulk controls when there are no beds", () => {
    render(<PlannerBedSheetsSection {...defaultProps()} />);
    expect(screen.queryByRole("button", { name: /bulk select/i })).not.toBeInTheDocument();
  });

  it("renders bed sheets when beds are present", () => {
    render(<PlannerBedSheetsSection {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.getByTestId("bed-sheet-1")).toBeInTheDocument();
    expect(screen.queryByText(/create your first bed/i)).not.toBeInTheDocument();
  });

  it("shows bulk controls when beds are present", () => {
    render(<PlannerBedSheetsSection {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.getByRole("button", { name: /bulk select/i })).toBeInTheDocument();
  });

  it("shows selection banner when a placement is selected and beds exist", () => {
    render(
      <PlannerBedSheetsSection
        {...defaultProps({ beds: [sampleBed], selectedPlacement: samplePlacement })}
      />,
    );
    expect(screen.getByText(/moving/i)).toBeInTheDocument();
    expect(screen.getByText("Tomato")).toBeInTheDocument();
  });

  it("does not show selection banner when no placement is selected", () => {
    render(
      <PlannerBedSheetsSection {...defaultProps({ beds: [sampleBed], selectedPlacement: null })} />,
    );
    expect(screen.queryByText(/moving/i)).not.toBeInTheDocument();
  });

  it("shows lasso hint when bulkMode is true and beds exist", () => {
    render(
      <PlannerBedSheetsSection
        {...defaultProps({ beds: [sampleBed], bulkMode: true })}
      />,
    );
    expect(screen.getByText(/lasso select/i)).toBeInTheDocument();
  });

  it("shows 'Create your first bed' text in the empty state", () => {
    render(<PlannerBedSheetsSection {...defaultProps()} />);
    expect(screen.getByText(/create your first bed/i)).toBeInTheDocument();
  });

  it("calls toggleBulkMode when bulk select button is clicked", () => {
    const toggleBulkMode = vi.fn();
    render(<PlannerBedSheetsSection {...defaultProps({ beds: [sampleBed], toggleBulkMode })} />);
    screen.getByRole("button", { name: /bulk select/i }).click();
    expect(toggleBulkMode).toHaveBeenCalled();
  });

  it("calls clearSelection when clear button is clicked", () => {
    const clearSelection = vi.fn();
    render(
      <PlannerBedSheetsSection
        {...defaultProps({
          beds: [sampleBed],
          selectedPlacementIds: [1],
          clearSelection,
        })}
      />,
    );
    screen.getByRole("button", { name: "Clear" }).click();
    expect(clearSelection).toHaveBeenCalled();
  });

  it("calls onBulkMovePlacements with correct deltas for directional buttons", () => {
    const onBulkMovePlacements = vi.fn();
    render(
      <PlannerBedSheetsSection
        {...defaultProps({
          beds: [sampleBed],
          selectedPlacementIds: [1],
          onBulkMovePlacements,
        })}
      />,
    );
    screen.getByRole("button", { name: "←" }).click();
    expect(onBulkMovePlacements).toHaveBeenCalledWith([1], -1, 0);
    screen.getByRole("button", { name: "→" }).click();
    expect(onBulkMovePlacements).toHaveBeenCalledWith([1], 1, 0);
    screen.getByRole("button", { name: "↑" }).click();
    expect(onBulkMovePlacements).toHaveBeenCalledWith([1], 0, -1);
    screen.getByRole("button", { name: "↓" }).click();
    expect(onBulkMovePlacements).toHaveBeenCalledWith([1], 0, 1);
  });

  it("calls clearSelection when cancel move button is clicked in selection banner", () => {
    const setSelectedPlacementId = vi.fn();
    render(
      <PlannerBedSheetsSection
        {...defaultProps({
          beds: [sampleBed],
          selectedPlacement: samplePlacement,
          setSelectedPlacementId,
        })}
      />,
    );
    screen.getByRole("button", { name: "Cancel move" }).click();
    expect(setSelectedPlacementId).toHaveBeenCalledWith(null);
  });

  it("calls onBulkRemovePlacements after window.confirm when removing selected", () => {
    const onBulkRemovePlacements = vi.fn();
    const clearSelection = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(
      <PlannerBedSheetsSection
        {...defaultProps({
          beds: [sampleBed],
          selectedPlacementIds: [1],
          onBulkRemovePlacements,
          clearSelection,
        })}
      />,
    );
    screen.getByRole("button", { name: "Remove selected" }).click();
    expect(onBulkRemovePlacements).toHaveBeenCalledWith([1]);
    expect(clearSelection).toHaveBeenCalled();
  });
});
