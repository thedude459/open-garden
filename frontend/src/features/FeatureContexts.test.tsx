import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalendarProvider, useCalendarContext } from "./calendar/CalendarContext";
import { PlannerProvider, usePlannerContext } from "./planner/PlannerContext";
import { SeasonalPlanProvider, useSeasonalPlanContext } from "./planning/SeasonalPlanContext";

function CalendarConsumer() {
  const context = useCalendarContext();
  return <div>{context.selectedCropName}</div>;
}

function PlannerConsumer() {
  const context = usePlannerContext();
  return <div>{context.derived.selectedGardenName}</div>;
}

function SeasonalConsumer() {
  const context = useSeasonalPlanContext();
  return <div>{context.selectedGardenName}</div>;
}

afterEach(() => {
  cleanup();
});

describe("feature contexts", () => {
  it("provides calendar context values", () => {
    render(
      <CalendarProvider
        value={{
          monthCursor: new Date("2026-04-01"),
          setMonthCursor: () => undefined,
          selectedDate: "2026-04-04",
          setSelectedDate: () => undefined,
          today: "2026-04-04",
          beds: [],
          weather: null,
          gardenClimate: null,
          taskActions: {
            tasks: [], taskQuery: "", setTaskQuery: () => undefined, isLoadingTasks: false,
            createTask: () => undefined, createPlanting: () => undefined, toggleTaskDone: () => undefined,
            deleteTask: () => undefined, editTask: () => undefined, logHarvest: () => undefined,
          },
          cropFormState: {
            cropSearchQuery: "", setCropSearchQuery: () => undefined, handleCropSearchKeyDown: () => undefined,
            filteredCropTemplates: [], cropSearchActiveIndex: 0, selectCrop: () => undefined,
          },
          derived: { monthCells: [], eventsByDate: new Map(), selectedDayEvents: [], selectedGardenName: "Backyard" },
          selectedCropName: "Tomato",
          isLoadingPlantingWindows: false,
          isLoadingClimate: false,
          isLoadingWeather: false,
          pushNotice: () => undefined,
        }}
      >
        <CalendarConsumer />
      </CalendarProvider>,
    );

    expect(screen.getByText("Tomato")).toBeInTheDocument();
  });

  it("throws when calendar context hook is used outside its provider", () => {
    expect(() => render(<CalendarConsumer />)).toThrow("useCalendarContext must be used within CalendarProvider");
  });

  it("provides planner context values", () => {
    render(
      <PlannerProvider
        value={{
          beds: [],
          placements: [],
          cropTemplates: [],
          selectedCropName: "Tomato",
          selectedGardenRecord: undefined,
          gardenSunPath: null,
          yardGridRef: { current: null },
          derived: { yardWidthFt: 20, yardLengthFt: 30, cropMap: new Map(), selectedGardenName: "Backyard" },
          cropFormState: { cropSearchQuery: "", setCropSearchQuery: () => undefined, handleCropSearchKeyDown: () => undefined, filteredCropTemplates: [], cropSearchActiveIndex: 0, selectCrop: () => undefined },
          gardenActions: {
            yardWidthDraft: 20, yardLengthDraft: 30, setYardWidthDraft: () => undefined, setYardLengthDraft: () => undefined,
            createBed: () => undefined, updateYardSize: () => undefined,
            bedDraft: { name: "", width_ft: 4, length_ft: 8 }, setBedDraft: () => undefined,
            showBedValidation: false, bedFormErrors: { name: "", width_ft: "", length_ft: "" },
            showYardValidation: false, yardFormErrors: { yard_width_ft: "", yard_length_ft: "" },
          },
          plannerActions: {
            moveBedInYard: async () => undefined, nudgeBedByDelta: () => undefined, rotateBedInYard: async () => undefined,
            deleteBed: async () => undefined, addPlacement: async () => undefined, movePlacement: async () => undefined,
            nudgePlacementByDelta: () => undefined, movePlacementsByDelta: async () => undefined,
            removePlacementsBulk: async () => undefined, removePlacement: async () => undefined,
            placementSpacingConflict: () => null, isCellBlockedForSelectedCrop: () => false, isCellInBuffer: () => false,
          },
          placementBedId: null,
          setPlacementBedId: () => undefined,
          plannerUndoCount: 0,
          plannerRedoCount: 0,
          undoPlannerChange: async () => undefined,
          redoPlannerChange: async () => undefined,
          isLoadingGardenData: false,
          isLoadingSunPath: false,
          isLoadingPlantingWindows: false,
          pushNotice: () => undefined,
          setConfirmState: () => undefined,
          onGoToCrops: () => undefined,
        }}
      >
        <PlannerConsumer />
      </PlannerProvider>,
    );

    expect(screen.getByText("Backyard")).toBeInTheDocument();
  });

  it("throws when planner context hook is used outside its provider", () => {
    expect(() => render(<PlannerConsumer />)).toThrow("usePlannerContext must be used within PlannerProvider");
  });

  it("provides seasonal context values", () => {
    render(
      <SeasonalPlanProvider
        value={{
          selectedGardenName: "Backyard",
          seasonalPlan: null,
          selectedRecommendationPlantingId: null,
          plantingRecommendation: null,
          setSelectedRecommendationPlantingId: () => undefined,
          refreshSeasonalPlan: async () => undefined,
          isLoadingSeasonalPlan: false,
          isLoadingPlantingRecommendation: false,
          pushNotice: () => undefined,
        }}
      >
        <SeasonalConsumer />
      </SeasonalPlanProvider>,
    );

    expect(screen.getByText("Backyard")).toBeInTheDocument();
  });

  it("throws when seasonal context hook is used outside its provider", () => {
    expect(() => render(<SeasonalConsumer />)).toThrow("useSeasonalPlanContext must be used within SeasonalPlanProvider");
  });
});