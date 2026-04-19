import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerPanel } from "./PlannerPanel";
import { Bed, CropTemplate, Placement } from "../types";

afterEach(() => {
  cleanup();
});

function makeCrop(overrides: Partial<CropTemplate> = {}): CropTemplate {
  return {
    id: 1,
    name: "Tomato",
    variety: "",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "Solanaceae",
    spacing_in: 12,
    row_spacing_in: 18,
    in_row_spacing_in: 12,
    days_to_harvest: 75,
    planting_window: "Spring",
    direct_sow: false,
    frost_hardy: false,
    weeks_to_transplant: 6,
    notes: "",
    ...overrides,
  };
}

function makeBed(overrides: Partial<Bed> = {}): Bed {
  return {
    id: 10,
    garden_id: 5,
    name: "North Bed",
    width_in: 48,
    height_in: 96,
    grid_x: 1,
    grid_y: 1,
    ...overrides,
  };
}

function makePlacement(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 101,
    garden_id: 5,
    bed_id: 10,
    crop_name: "Tomato",
    grid_x: 0,
    grid_y: 0,
    planted_on: "2026-03-20",
    expected_harvest_on: "2026-07-01",
    color: "#ed7b49",
    method: "direct_seed",
    location: "in_bed",
    moved_on: null,
    source: "",
    harvested_on: null,
    yield_notes: "",
    ...overrides,
  };
}

type RotateBedFn = (bedId: number, autoFit?: boolean) => Promise<void>;
type RenameBedFn = (bedId: number, nextName: string) => Promise<void> | void;
type MovePlacementFn = (placementId: number, bedId: number, x: number, y: number) => void;
type NudgePlacementFn = (placementId: number, dx: number, dy: number) => void;
type BlockedMoveFn = (cropName: string) => void;
type SpacingConflictFn = (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
type DeleteBedFn = (bedId: number) => void;

function renderPlanner(options?: {
  beds?: Bed[];
  placements?: Placement[];
  cropTemplates?: CropTemplate[];
  yardWidthFt?: number;
  yardLengthFt?: number;
  onRotateBed?: RotateBedFn;
  onRenameBed?: RenameBedFn;
  onNudgePlacement?: NudgePlacementFn;
  onMovePlacement?: MovePlacementFn;
  onBlockedPlacementMove?: BlockedMoveFn;
  placementSpacingConflict?: SpacingConflictFn;
  onDeleteBed?: DeleteBedFn;
  /** Open the Manage Plantings tab (bed grids and placement UI live here). */
  openPlantingsTab?: boolean;
}) {
  const onRotateBed: RotateBedFn = options?.onRotateBed ?? (vi.fn().mockResolvedValue(undefined) as unknown as RotateBedFn);
  const onRenameBed: RenameBedFn = options?.onRenameBed ?? (vi.fn().mockResolvedValue(undefined) as unknown as RenameBedFn);
  const onNudgePlacement: NudgePlacementFn = options?.onNudgePlacement ?? (vi.fn() as unknown as NudgePlacementFn);
  const onMovePlacement: MovePlacementFn = options?.onMovePlacement ?? (vi.fn() as unknown as MovePlacementFn);
  const onBlockedPlacementMove: BlockedMoveFn = options?.onBlockedPlacementMove ?? (vi.fn() as unknown as BlockedMoveFn);
  const placementSpacingConflict: SpacingConflictFn = options?.placementSpacingConflict ?? (vi.fn().mockReturnValue(null) as unknown as SpacingConflictFn);
  const onDeleteBed: DeleteBedFn = options?.onDeleteBed ?? (vi.fn() as unknown as DeleteBedFn);
  const openPlantingsTab = options?.openPlantingsTab ?? false;

  render(
    <PlannerPanel
      layout={{
        isLoadingGardenData: false,
        beds: options?.beds || [makeBed()],
        placements: options?.placements || [],
        cropTemplates: options?.cropTemplates || [makeCrop()],
        yardWidthFt: options?.yardWidthFt ?? 12,
        yardLengthFt: options?.yardLengthFt ?? 12,
        gardenSunPath: null,
        isLoadingSunPath: false,
        isLoadingPlantingWindows: false,
        gardenOrientation: "south",
      }}
      forms={{
        bedName: "",
        bedWidthFt: 4,
        bedLengthFt: 8,
        yardWidthDraft: 20,
        yardLengthDraft: 20,
        bedErrors: { name: "", width_ft: "", length_ft: "" },
        yardErrors: { yard_width_ft: "", yard_length_ft: "" },
        onBedNameChange: vi.fn(),
        onBedWidthFtChange: vi.fn(),
        onBedLengthFtChange: vi.fn(),
        onYardWidthDraftChange: vi.fn(),
        onYardLengthDraftChange: vi.fn(),
        onCreateBed: vi.fn(),
        onUpdateYardSize: vi.fn(),
        onGoToCrops: vi.fn(),
      }}
      crop={{
        cropSearchQuery: "",
        onCropSearchQueryChange: vi.fn(),
        onCropSearchKeyDown: vi.fn(),
        filteredCropTemplates: options?.cropTemplates || [makeCrop()],
        cropSearchActiveIndex: 0,
        selectedCropName: "Tomato",
        selectedCrop: makeCrop(),
        selectedCropWindow: undefined,
        onSelectCrop: vi.fn(),
        cropBaseName: (crop) => crop.name,
      }}
      planner={{
        placementBedId: null,
        onPlacementBedIdChange: vi.fn(),
        yardGridRef: createRef<HTMLDivElement>(),
        yardCellPx: 24,
        onMoveBedInYard: vi.fn(),
        onNudgeBed: vi.fn(),
        onRotateBed,
        onRenameBed,
        onDeleteBed,
        onAddPlacement: vi.fn(),
        onMovePlacement,
        onNudgePlacement,
        onBulkMovePlacements: vi.fn(),
        onBulkRemovePlacements: vi.fn(),
        onRequestRemovePlacement: vi.fn(),
        onRelocatePlanting: vi.fn(),
        onUpdatePlantingDates: vi.fn(),
        plantingMethod: "direct_seed",
        setPlantingMethod: vi.fn(),
        plantingLocation: "in_bed",
        setPlantingLocation: vi.fn(),
        plantingDate: "2026-04-01",
        setPlantingDate: vi.fn(),
        plantingMovedOn: null,
        setPlantingMovedOn: vi.fn(),
        onBlockedPlacementMove,
        placementSpacingConflict,
        isCellBlockedForSelectedCrop: vi.fn().mockReturnValue(false),
        isCellInBuffer: vi.fn().mockReturnValue(false),
      }}
      history={{
        canUndoPlanner: false,
        canRedoPlanner: false,
        onUndoPlanner: vi.fn(),
        onRedoPlanner: vi.fn(),
      }}
    />,
  );

  if (openPlantingsTab) {
    fireEvent.click(screen.getByRole("tab", { name: /manage plantings/i }));
  }

  return { onRotateBed, onRenameBed, onNudgePlacement, onMovePlacement, onBlockedPlacementMove, onDeleteBed };
}

describe("PlannerPanel", () => {
  it("shows rotate preview and calls rotate without auto-fit when bed already fits", async () => {
    const { onRotateBed } = renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /rotate north bed/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Rotate North Bed to 8 x 4 ft.");

    const rotateNow = screen.getByRole("button", { name: "Rotate now" });
    expect(rotateNow).toBeEnabled();

    fireEvent.click(rotateNow);
    await waitFor(() => {
      expect(onRotateBed).toHaveBeenCalledWith(10, false);
    });
  });

  it("offers auto-fit rotate when current position would overflow", () => {
    const edgeBed = makeBed({ grid_x: 3, grid_y: 1, width_in: 96, height_in: 48, name: "Edge Bed" });
    const { onRotateBed } = renderPlanner({ beds: [edgeBed], yardWidthFt: 8, yardLengthFt: 8 });

    fireEvent.click(screen.getByRole("button", { name: /rotate edge bed/i }));
    expect(screen.getByText(/Current spot is out of bounds after rotate\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Auto-fit rotate" }));
    expect(onRotateBed).toHaveBeenCalledWith(10, true);
  });

  it("renders planting markers in the grid and photos in the legend when crop image is available", () => {
    const crop = makeCrop({ name: "Tomato", image_url: "https://example.com/tomato.jpg" });
    const placement = makePlacement({ crop_name: "Tomato" });
    renderPlanner({ cropTemplates: [crop], placements: [placement], openPlantingsTab: true });

    expect(document.querySelectorAll(".plot-cell-marker").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("img.legend-photo").length).toBeGreaterThan(0);
    expect(screen.getByText("Tomato (1)")).toBeInTheDocument();
  });

  it("uses default photo fallback in legend when crop has no photo", () => {
    const crop = makeCrop({ name: "Tomato", image_url: "" });
    const placement = makePlacement({ crop_name: "Tomato" });
    renderPlanner({ cropTemplates: [crop], placements: [placement], openPlantingsTab: true });

    const legend = screen.getAllByLabelText("North Bed crop legend")[0];
    expect(within(legend).getByText("Tomato (1)")).toBeInTheDocument();
    expect(legend.querySelectorAll("img.legend-photo").length).toBeGreaterThan(0);
  });

  it("shows row and in-row spacing hints for each placement", () => {
    const crop = makeCrop({ name: "Tomato", row_spacing_in: 14, in_row_spacing_in: 14 });
    const placement = makePlacement({ crop_name: "Tomato" });
    renderPlanner({ cropTemplates: [crop], placements: [placement], openPlantingsTab: true });

    expect(screen.getAllByText(/Row 14 in · In-row 14 in/i).length).toBeGreaterThan(0);
  });

  it("renames a bed from the bed sheet header", () => {
    const { onRenameBed } = renderPlanner({ openPlantingsTab: true });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Rename North Bed/i }), {
      target: { value: "Herb Bed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onRenameBed).toHaveBeenCalledWith(10, "Herb Bed");
  });

  it("deletes a bed from yard layout controls", () => {
    const { onDeleteBed } = renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /delete north bed/i }));
    expect(onDeleteBed).toHaveBeenCalledWith(10);
  });

  it("supports keyboard nudge for placement chips", () => {
    const placement = makePlacement({ crop_name: "Tomato" });
    const { onNudgePlacement } = renderPlanner({ placements: [placement], openPlantingsTab: true });

    const chip = screen.getByRole("button", {
      name: /Tomato at column 1, row 1\. Arrow keys move; Enter removes\./i,
    });
    fireEvent.keyDown(chip, { key: "ArrowRight" });

    expect(onNudgePlacement).toHaveBeenCalledWith(101, 1, 0);
  });

  it("blocks drag-drop moves when spacing conflict exists", () => {
    const placement = makePlacement({ crop_name: "Tomato" });
    const placementSpacingConflict = vi.fn().mockImplementation((bedId: number, x: number, y: number) => {
      if (bedId === 10 && x === 1 && y === 0) return "Too close";
      return null;
    });
    const { onBlockedPlacementMove, onMovePlacement } = renderPlanner({
      placements: [placement],
      placementSpacingConflict,
      openPlantingsTab: true,
    });

    const targetCell = screen.getByLabelText("Empty square column 2, row 1");
    fireEvent.dragOver(targetCell);
    fireEvent.drop(targetCell, {
      dataTransfer: {
        getData: (type: string) =>
          type === "application/json" ? JSON.stringify({ placementId: 101 }) : "",
      },
    });

    expect(onBlockedPlacementMove).toHaveBeenCalledWith("Tomato");
    expect(onMovePlacement).not.toHaveBeenCalled();
  });

  it("starts on Setup tab and shows create bed form and yard layout", () => {
    renderPlanner();

    const setupTab = screen.getByRole("tab", { name: /setup yard/i });
    expect(setupTab).toHaveClass("active");

    // Verify Setup tab content is displayed
    expect(screen.getByText("Create Bed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /yard layout/i })).toBeInTheDocument();
  });

  it("switches to Plantings tab when clicked", () => {
    renderPlanner();

    const plantingsTab = screen.getByRole("tab", { name: /manage plantings/i });
    fireEvent.click(plantingsTab);

    expect(plantingsTab).toHaveClass("active");
    // Verify Plantings tab content is displayed
    expect(screen.getByText("Placement Tools")).toBeInTheDocument();
    expect(screen.getByText(/Search Vegetable/i)).toBeInTheDocument();
  });

  it("switches back to Setup tab when clicked", () => {
    renderPlanner();

    const plantingsTab = screen.getByRole("tab", { name: /manage plantings/i });
    fireEvent.click(plantingsTab);

    const setupTab = screen.getByRole("tab", { name: /setup yard/i });
    fireEvent.click(setupTab);

    expect(setupTab).toHaveClass("active");
    expect(screen.getByText("Create Bed")).toBeInTheDocument();
  });
});
