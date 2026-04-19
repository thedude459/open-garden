import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarPage } from "./calendar/CalendarPage";
import { PlannerPage } from "./planner/PlannerPage";
import { SeasonalPlanPage } from "./planning/SeasonalPlanPage";
import { CropsPageSection } from "./crops/CropsPageSection";
import { CalendarContextType } from "./calendar/CalendarContext";
import { PlannerContextType } from "./planner/PlannerContext";
import { SeasonalPlanContextType } from "./planning/SeasonalPlanContext";
import { CropTemplate } from "./types";

let latestCropsProps: Parameters<typeof import("./crops/CropsPanel")["CropsPanel"]>[0] | null = null;

vi.mock("./calendar/CalendarWeatherSection", async () => {
  const module = await vi.importActual<typeof import("./calendar/CalendarContext")>("./calendar/CalendarContext");
  return {
    CalendarWeatherSection: () => {
      const context = module.useCalendarContext();
      return <div data-testid="calendar-page">{context.selectedCropName}</div>;
    },
  };
});

vi.mock("./planner/PlannerPageSection", async () => {
  const module = await vi.importActual<typeof import("./planner/PlannerContext")>("./planner/PlannerContext");
  return {
    PlannerPageSection: () => {
      const context = module.usePlannerContext();
      return <div data-testid="planner-page">{context.derived.selectedGardenName}:{String(context.yardGridRef.current === null)}</div>;
    },
  };
});

vi.mock("./planning/SeasonalPageSection", async () => {
  const module = await vi.importActual<typeof import("./planning/SeasonalPlanContext")>("./planning/SeasonalPlanContext");
  return {
    SeasonalPageSection: () => {
      const context = module.useSeasonalPlanContext();
      return <div data-testid="seasonal-page">{context.selectedGardenName}</div>;
    },
  };
});

vi.mock("./crops/CropsPanel", () => ({
  CropsPanel: (props: Parameters<typeof import("./crops/CropsPanel")["CropsPanel"]>[0]) => {
    latestCropsProps = props;
    return (
      <div>
        <div data-testid="crops-page">{props.cropErrors.name || "no-errors"}</div>
        <button type="button" onClick={props.onRefreshLibrary}>Refresh library</button>
        <button type="button" onClick={props.onCleanupLegacyLibrary}>Cleanup library</button>
      </div>
    );
  },
}));

const cropTemplate: CropTemplate = {
  id: 1,
  name: "Tomato",
  variety: "Roma",
  source: "manual",
  source_url: "",
  image_url: "",
  external_product_id: "",
  family: "Solanaceae",
  spacing_in: 18,
  row_spacing_in: 60,
  in_row_spacing_in: 24,
  days_to_harvest: 70,
  planting_window: "Spring",
  direct_sow: false,
  frost_hardy: false,
  weeks_to_transplant: 6,
  notes: "",
};

describe("feature page wrappers", () => {
  beforeEach(() => {
    latestCropsProps = null;
  });

  it("provides calendar context to the calendar page section", () => {
    const props: CalendarContextType = {
      monthCursor: new Date("2026-04-01"),
      setMonthCursor: vi.fn(),
      selectedDate: "2026-04-04",
      setSelectedDate: vi.fn(),
      today: "2026-04-04",
      beds: [],
      weather: null,
      gardenClimate: null,
      taskActions: {
        tasks: [],
        taskQuery: "",
        setTaskQuery: vi.fn(),
        isLoadingTasks: false,
        createTask: vi.fn(),
        toggleTaskDone: vi.fn(),
        deleteTask: vi.fn(),
        editTask: vi.fn(),
        logHarvest: vi.fn(),
      },
      cropFormState: {
        cropSearchQuery: "",
        setCropSearchQuery: vi.fn(),
        handleCropSearchKeyDown: vi.fn(),
        filteredCropTemplates: [cropTemplate],
        cropSearchActiveIndex: 0,
        selectCrop: vi.fn(),
      },
      derived: {
        selectedGardenName: "Backyard",
        monthCells: [],
        eventsByDate: new Map(),
        selectedDayEvents: [],
        selectedCrop: cropTemplate,
        selectedCropWindow: undefined,
      },
      selectedCropName: "Tomato",
      isLoadingPlantingWindows: false,
      isLoadingClimate: false,
      isLoadingWeather: false,
      pushNotice: vi.fn(),
    };

    render(<CalendarPage {...props} />);

    expect(screen.getByTestId("calendar-page")).toHaveTextContent("Tomato");
  });

  it("provides planner context and yard ref to the planner page section", () => {
    const props: Omit<PlannerContextType, "yardGridRef"> = {
      beds: [],
      placements: [],
      cropTemplates: [cropTemplate],
      selectedCropName: "Tomato",
      selectedGardenRecord: undefined,
      gardenSunPath: null,
      derived: { yardWidthFt: 20, yardLengthFt: 30, selectedCrop: cropTemplate, selectedCropWindow: undefined, selectedGardenName: "Backyard", cropMap: new Map([["Tomato", cropTemplate]]) },
      cropFormState: {
        cropSearchQuery: "",
        setCropSearchQuery: vi.fn(),
        handleCropSearchKeyDown: vi.fn(),
        filteredCropTemplates: [cropTemplate],
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
        moveBedInYard: vi.fn(async () => undefined),
        nudgeBedByDelta: vi.fn(),
        rotateBedInYard: vi.fn(async () => undefined),
        renameBed: vi.fn(async () => undefined),
        deleteBed: vi.fn(async () => undefined),
        addPlacement: vi.fn(async () => undefined),
        movePlacement: vi.fn(async () => undefined),
        nudgePlacementByDelta: vi.fn(),
        movePlacementsByDelta: vi.fn(async () => undefined),
        removePlacementsBulk: vi.fn(async () => undefined),
        removePlacement: vi.fn(async () => undefined),
        relocatePlanting: vi.fn(async () => undefined),
        updatePlantingDates: vi.fn(async () => undefined),
        placementSpacingConflict: vi.fn(() => null),
        isCellBlockedForSelectedCrop: vi.fn(() => false),
        isCellInBuffer: vi.fn(() => false),
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
      undoPlannerChange: vi.fn(async () => undefined),
      redoPlannerChange: vi.fn(async () => undefined),
      isLoadingGardenData: false,
      isLoadingSunPath: false,
      isLoadingPlantingWindows: false,
      pushNotice: vi.fn(),
      setConfirmState: vi.fn(),
      onGoToCrops: vi.fn(),
    };

    render(<PlannerPage {...props} />);

    expect(screen.getByTestId("planner-page")).toHaveTextContent("Backyard:true");
  });

  it("provides seasonal plan context to the page section", () => {
    const props: SeasonalPlanContextType = {
      selectedGardenName: "Backyard",
      seasonalPlan: null,
      selectedRecommendationPlantingId: null,
      plantingRecommendation: null,
      setSelectedRecommendationPlantingId: vi.fn(),
      refreshSeasonalPlan: vi.fn(async () => undefined),
      isLoadingSeasonalPlan: false,
      isLoadingPlantingRecommendation: false,
      pushNotice: vi.fn(),
    };

    render(<SeasonalPlanPage {...props} />);

    expect(screen.getByTestId("seasonal-page")).toHaveTextContent("Backyard");
  });

  it("maps crop form state into the crops page section", async () => {
    const refreshCropTemplateDatabase = vi.fn(async () => undefined);
    const requestLegacyCropCleanup = vi.fn();
    const cropFormState = {
      editingCropId: 1,
      newCropName: "Tomato",
      setNewCropName: vi.fn(),
      newCropVariety: "Roma",
      setNewCropVariety: vi.fn(),
      newCropFamily: "Solanaceae",
      setNewCropFamily: vi.fn(),
      newCropSpacing: 18,
      setNewCropSpacing: vi.fn(),
      newCropDays: 70,
      setNewCropDays: vi.fn(),
      newCropPlantingWindow: "Spring",
      setNewCropPlantingWindow: vi.fn(),
      newCropDirectSow: false,
      setNewCropDirectSow: vi.fn(),
      newCropFrostHardy: false,
      setNewCropFrostHardy: vi.fn(),
      newCropWeeksToTransplant: 6,
      setNewCropWeeksToTransplant: vi.fn(),
      newCropNotes: "",
      setNewCropNotes: vi.fn(),
      newCropImageUrl: "",
      setNewCropImageUrl: vi.fn(),
      showCropValidation: true,
      cropFormErrors: { name: "Required", spacing: "", days: "", planting_window: "", weeks_to_transplant: "" },
      upsertCropTemplate: vi.fn(),
      resetCropForm: vi.fn(),
      populateCropForm: vi.fn(),
    };

    render(
      <CropsPageSection
        cropTemplates={[cropTemplate]}
        isRefreshingCropLibrary={false}
        isCleaningLegacyCropLibrary={false}
        cropTemplateSyncStatus={null}
        refreshCropTemplateDatabase={refreshCropTemplateDatabase}
        requestLegacyCropCleanup={requestLegacyCropCleanup}
        cropFormState={cropFormState as unknown as Parameters<typeof CropsPageSection>[0]["cropFormState"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh library" }));
    fireEvent.click(screen.getByRole("button", { name: "Cleanup library" }));

    await waitFor(() => {
      expect(refreshCropTemplateDatabase).toHaveBeenCalledTimes(1);
    });

    expect(requestLegacyCropCleanup).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("crops-page")).toHaveTextContent("Required");
    expect(latestCropsProps?.editingCropId).toBe(1);
  });
});