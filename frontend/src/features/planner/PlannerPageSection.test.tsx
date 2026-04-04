import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerProvider, PlannerContextType } from "./PlannerContext";
import { PlannerPageSection } from "./PlannerPageSection";
import { Bed, CropTemplate, Garden, Placement } from "../../types";

vi.mock("./PlannerPanel", () => ({
  PlannerPanel: ({ selectedCropName, beds }: { selectedCropName: string; beds: Bed[] }) => (
    <div data-testid="planner-panel">crop:{selectedCropName};beds:{beds.length}</div>
  ),
}));

const sampleGarden: Garden = {
  id: 1,
  name: "Garden",
  description: "",
  zip_code: "12345",
  growing_zone: "7a",
  yard_width_ft: 20,
  yard_length_ft: 30,
  latitude: 40,
  longitude: -74,
  orientation: "south",
  sun_exposure: "full_sun",
  wind_exposure: "moderate",
  thermal_mass: "moderate",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  is_shared: false,
  edge_buffer_in: 6,
};

const sampleCrop: CropTemplate = {
  id: 1,
  name: "Tomato",
  variety: "Roma",
  source: "manual",
  source_url: "",
  image_url: "",
  external_product_id: "",
  family: "Solanaceae",
  spacing_in: 12,
  days_to_harvest: 70,
  planting_window: "Spring",
  direct_sow: false,
  frost_hardy: false,
  weeks_to_transplant: 6,
  notes: "",
};

function buildPlannerContextValue(): PlannerContextType {
  const beds: Bed[] = [{ id: 1, garden_id: 1, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
  const placements: Placement[] = [];

  return {
    beds,
    placements,
    cropTemplates: [sampleCrop],
    selectedCropName: "Tomato",
    selectedGardenRecord: sampleGarden,
    gardenSunPath: null,
    yardGridRef: createRef<HTMLDivElement>(),
    derived: {
      yardWidthFt: 20,
      yardLengthFt: 30,
      selectedCrop: sampleCrop,
      selectedCropWindow: undefined,
      selectedGardenName: "Garden",
      cropMap: new Map([[sampleCrop.name, sampleCrop]]),
    },
    cropFormState: {
      cropSearchQuery: "",
      setCropSearchQuery: vi.fn(),
      handleCropSearchKeyDown: vi.fn(),
      filteredCropTemplates: [sampleCrop],
      cropSearchActiveIndex: 0,
      selectCrop: vi.fn(),
    },
    gardenActions: {
      yardWidthDraft: 20,
      yardLengthDraft: 30,
      setYardWidthDraft: vi.fn(),
      setYardLengthDraft: vi.fn(),
      createBed: vi.fn(),
      updateYardSize: vi.fn(),
      bedDraft: { name: "", width_ft: 4, length_ft: 8 },
      setBedDraft: vi.fn(),
      showBedValidation: false,
      bedFormErrors: { name: "", width_ft: "", length_ft: "" },
      showYardValidation: false,
      yardFormErrors: { yard_width_ft: "", yard_length_ft: "" },
    },
    plannerActions: {
      moveBedInYard: vi.fn().mockResolvedValue(undefined),
      nudgeBedByDelta: vi.fn(),
      rotateBedInYard: vi.fn().mockResolvedValue(undefined),
      deleteBed: vi.fn().mockResolvedValue(undefined),
      addPlacement: vi.fn().mockResolvedValue(undefined),
      movePlacement: vi.fn().mockResolvedValue(undefined),
      nudgePlacementByDelta: vi.fn(),
      movePlacementsByDelta: vi.fn().mockResolvedValue(undefined),
      removePlacementsBulk: vi.fn().mockResolvedValue(undefined),
      removePlacement: vi.fn().mockResolvedValue(undefined),
      placementSpacingConflict: vi.fn().mockReturnValue(null),
      isCellBlockedForSelectedCrop: vi.fn().mockReturnValue(false),
      isCellInBuffer: vi.fn().mockReturnValue(false),
    },
    placementBedId: null,
    setPlacementBedId: vi.fn(),
    plannerUndoCount: 0,
    plannerRedoCount: 0,
    undoPlannerChange: vi.fn(),
    redoPlannerChange: vi.fn(),
    isLoadingGardenData: false,
    isLoadingSunPath: false,
    isLoadingPlantingWindows: false,
    pushNotice: vi.fn(),
    setConfirmState: vi.fn(),
    toFeet: (inches: number) => `${(inches / 12).toFixed(1)} ft`,
    onGoToCrops: vi.fn(),
  };
}

describe("PlannerPageSection", () => {
  it("renders planner panel with planner context values", () => {
    render(
      <PlannerProvider value={buildPlannerContextValue()}>
        <PlannerPageSection />
      </PlannerProvider>,
    );

    expect(screen.getByTestId("planner-panel")).toHaveTextContent("crop:Tomato;beds:1");
  });
});
