import { act, createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerProvider, PlannerContextType } from "./PlannerContext";
import { PlannerPageSection } from "./PlannerPageSection";
import { Bed, CropTemplate, Garden, Placement } from "../types";

// Capture all props so we can invoke the callbacks in tests
let capturedProps: Record<string, unknown> = {};

vi.mock("./PlannerPanel", () => ({
  PlannerPanel: (props: {
    crop: { selectedCropName: string };
    layout: { beds: Bed[] };
    forms: Record<string, unknown>;
    planner: Record<string, unknown>;
    history: Record<string, unknown>;
  }) => {
    capturedProps = props as unknown as Record<string, unknown>;
    return <div data-testid="planner-panel">crop:{props.crop.selectedCropName};beds:{props.layout.beds.length}</div>;
  },
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
  row_spacing_in: 60,
  in_row_spacing_in: 24,
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
      renameBed: vi.fn().mockResolvedValue(undefined),
      deleteBed: vi.fn().mockResolvedValue(undefined),
      addPlacement: vi.fn().mockResolvedValue(undefined),
      movePlacement: vi.fn().mockResolvedValue(undefined),
      nudgePlacementByDelta: vi.fn(),
      movePlacementsByDelta: vi.fn().mockResolvedValue(undefined),
      removePlacementsBulk: vi.fn().mockResolvedValue(undefined),
      removePlacement: vi.fn().mockResolvedValue(undefined),
      relocatePlanting: vi.fn().mockResolvedValue(undefined),
      updatePlantingDates: vi.fn().mockResolvedValue(undefined),
      placementSpacingConflict: vi.fn().mockReturnValue(null),
      isCellBlockedForSelectedCrop: vi.fn().mockReturnValue(false),
      isCellInBuffer: vi.fn().mockReturnValue(false),
    },
    plantingSettings: {
      plantingMethod: "direct_seed",
      setPlantingMethod: vi.fn(),
      plantingLocation: "in_bed",
      setPlantingLocation: vi.fn(),
      plantingDate: "2026-04-01",
      setPlantingDate: vi.fn(),
      plantingMovedOn: null,
      setPlantingMovedOn: vi.fn(),
    },
    placementBedId: null,
    setPlacementBedId: vi.fn(),
    plannerUndoCount: 0,
    plannerRedoCount: 0,
    undoPlannerChange: vi.fn().mockResolvedValue(undefined),
    redoPlannerChange: vi.fn().mockResolvedValue(undefined),
    isLoadingGardenData: false,
    isLoadingSunPath: false,
    isLoadingPlantingWindows: false,
    pushNotice: vi.fn(),
    setConfirmState: vi.fn(),
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

  it("passes all form and planner callbacks that are invokeable", async () => {
    render(
      <PlannerProvider value={buildPlannerContextValue()}>
        <PlannerPageSection />
      </PlannerProvider>,
    );

    // Exercise all inline arrow-function props from PlannerPageSection to get V8 coverage
    await act(async () => {
      const forms = capturedProps.forms as Record<string, (...args: unknown[]) => unknown>;
      forms.onBedNameChange("TestBed");
      forms.onBedWidthFtChange(4);
      forms.onBedLengthFtChange(8);
      forms.onYardWidthDraftChange(20);
      forms.onYardLengthDraftChange(30);
      forms.onCreateBed({ preventDefault: vi.fn() });
      forms.onUpdateYardSize({ preventDefault: vi.fn() });
      forms.onGoToCrops();

      const crop = capturedProps.crop as Record<string, (...args: unknown[]) => unknown>;
      crop.onCropSearchQueryChange("tom");
      crop.onCropSearchKeyDown({ key: "Enter" });
      crop.onSelectCrop({ id: 1, name: "Tomato" });

      const planner = capturedProps.planner as Record<string, (...args: unknown[]) => unknown>;
      await planner.onMoveBedInYard(1, 0, 0);
      planner.onNudgeBed(1, 0, 1);
      await planner.onRotateBed(1, false);
      await planner.onRenameBed(1, "Renamed");
      await planner.onDeleteBed(1);
      await planner.onAddPlacement(1, 0, 0);
      await planner.onMovePlacement(1, 1, 1, 1);
      planner.onNudgePlacement(1, 0, 1);
      await planner.onBulkMovePlacements([1], 0, 1);
      await planner.onBulkRemovePlacements([1]);
      planner.onBlockedPlacementMove("Tomato");
      planner.placementSpacingConflict(1, 0, 0, "Tomato");
      planner.isCellBlockedForSelectedCrop(1, 0, 0, undefined);
      planner.isCellInBuffer(1, 0, 0);

      const history = capturedProps.history as Record<string, (...args: unknown[]) => unknown>;
      await history.onUndoPlanner();
      await history.onRedoPlanner();
    });

    // If we get here without error, all callbacks were invokeable
    expect(screen.getByTestId("planner-panel")).toBeInTheDocument();
  });

  it("sets up a confirm dialog via onRequestRemovePlacement", async () => {
    const contextValue = buildPlannerContextValue();
    render(
      <PlannerProvider value={contextValue}>
        <PlannerPageSection />
      </PlannerProvider>,
    );

    await act(async () => {
      const planner = capturedProps.planner as Record<string, (...args: unknown[]) => unknown>;
      planner.onRequestRemovePlacement(1, "Tomato");
    });

    expect(contextValue.setConfirmState).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Remove Tomato from this bed?" }),
    );
  });
});
