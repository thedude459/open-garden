import { createRef } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    color: "#ed7b49",
    ...overrides,
  };
}

function renderPlanner(options?: {
  beds?: Bed[];
  placements?: Placement[];
  cropTemplates?: CropTemplate[];
  yardWidthFt?: number;
  yardLengthFt?: number;
  onRotateBed?: ReturnType<typeof vi.fn>;
}) {
  const onRotateBed = options?.onRotateBed || vi.fn().mockResolvedValue(undefined);

  render(
    <PlannerPanel
      isLoadingGardenData={false}
      beds={options?.beds || [makeBed()]}
      placements={options?.placements || []}
      cropTemplates={options?.cropTemplates || [makeCrop()]}
      bedName=""
      bedWidthFt={4}
      bedLengthFt={8}
      yardWidthFt={options?.yardWidthFt ?? 20}
      yardLengthFt={options?.yardLengthFt ?? 20}
      yardWidthDraft={20}
      yardLengthDraft={20}
      onBedNameChange={vi.fn()}
      onBedWidthFtChange={vi.fn()}
      onBedLengthFtChange={vi.fn()}
      onYardWidthDraftChange={vi.fn()}
      onYardLengthDraftChange={vi.fn()}
      bedErrors={{ name: "", width_ft: "", length_ft: "" }}
      yardErrors={{ yard_width_ft: "", yard_length_ft: "" }}
      onCreateBed={vi.fn()}
      onUpdateYardSize={vi.fn()}
      onGoToCrops={vi.fn()}
      cropSearchQuery=""
      onCropSearchQueryChange={vi.fn()}
      onCropSearchKeyDown={vi.fn()}
      filteredCropTemplates={options?.cropTemplates || [makeCrop()]}
      cropSearchActiveIndex={0}
      selectedCropName="Tomato"
      selectedCrop={makeCrop()}
      selectedCropWindow={undefined}
      isLoadingPlantingWindows={false}
      gardenSunPath={null}
      isLoadingSunPath={false}
      gardenOrientation="south"
      onSelectCrop={vi.fn()}
      cropBaseName={(crop) => crop.name}
      placementBedId={null}
      onPlacementBedIdChange={vi.fn()}
      yardGridRef={createRef<HTMLDivElement>()}
      yardCellPx={24}
      toFeet={(inches) => `${(inches / 12).toFixed(1)} ft`}
      onMoveBedInYard={vi.fn()}
      onNudgeBed={vi.fn()}
      onRotateBed={onRotateBed}
      onDeleteBed={vi.fn()}
      onAddPlacement={vi.fn()}
      onMovePlacement={vi.fn()}
      onNudgePlacement={vi.fn()}
      onBulkMovePlacements={vi.fn()}
      onBulkRemovePlacements={vi.fn()}
      canUndoPlanner={false}
      canRedoPlanner={false}
      onUndoPlanner={vi.fn()}
      onRedoPlanner={vi.fn()}
      onRequestRemovePlacement={vi.fn()}
      onBlockedPlacementMove={vi.fn()}
      placementSpacingConflict={vi.fn().mockReturnValue(null)}
      isCellBlockedForSelectedCrop={vi.fn().mockReturnValue(false)}
    />,
  );

  return { onRotateBed };
}

describe("PlannerPanel", () => {
  it("shows rotate preview and calls rotate without auto-fit when bed already fits", async () => {
    const { onRotateBed } = renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: "Rotate 90°" }));
    expect(screen.getByRole("status")).toHaveTextContent("Rotate North Bed to 8 x 4 ft.");

    const rotateNow = screen.getByRole("button", { name: "Rotate now" });
    expect(rotateNow).toBeEnabled();

    fireEvent.click(rotateNow);
    expect(onRotateBed).toHaveBeenCalledWith(10, false);
  });

  it("offers auto-fit rotate when current position would overflow", () => {
    const edgeBed = makeBed({ grid_x: 3, grid_y: 1, width_in: 96, height_in: 48, name: "Edge Bed" });
    const { onRotateBed } = renderPlanner({ beds: [edgeBed], yardWidthFt: 8, yardLengthFt: 8 });

    fireEvent.click(screen.getAllByRole("button", { name: "Rotate 90°" })[0]);
    expect(screen.getByText(/Current spot is out of bounds after rotate\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Auto-fit rotate" }));
    expect(onRotateBed).toHaveBeenCalledWith(10, true);
  });

  it("renders placement photos in the grid and legend when crop image is available", () => {
    const crop = makeCrop({ name: "Tomato", image_url: "https://example.com/tomato.jpg" });
    const placement = makePlacement({ crop_name: "Tomato" });
    renderPlanner({ cropTemplates: [crop], placements: [placement] });

    expect(document.querySelectorAll("img.plot-cell-photo").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("img.legend-photo").length).toBeGreaterThan(0);
    expect(screen.getByText("Tomato (1)")).toBeInTheDocument();
  });

  it("uses icon fallback in legend when crop has no photo", () => {
    const crop = makeCrop({ name: "Tomato", image_url: "" });
    const placement = makePlacement({ crop_name: "Tomato" });
    renderPlanner({ cropTemplates: [crop], placements: [placement] });

    const legend = screen.getAllByLabelText("North Bed crop legend")[0];
    expect(within(legend).getByText("Tomato (1)")).toBeInTheDocument();
    expect(within(legend).getByText("🍅")).toBeInTheDocument();
  });
});
