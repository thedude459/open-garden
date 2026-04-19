import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getLocalIsoWeekRange, useDerivedGardenState } from "./useDerivedGardenState";
import type {
  CropTemplate,
  Garden,
  GardenClimate,
  GardenClimatePlantingWindows,
  Planting,
  Task,
} from "../../types";

const sampleGarden: Garden = {
  id: 1,
  name: "Test Garden",
  description: "",
  zip_code: "80301",
  growing_zone: "6a",
  yard_width_ft: 20,
  yard_length_ft: 30,
  latitude: 40,
  longitude: -105,
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

function defaultParams(overrides: Partial<Parameters<typeof useDerivedGardenState>[0]> = {}) {
  return {
    today: "2026-04-08",
    tasks: [],
    plantings: [],
    monthCursor: new Date(2026, 3, 1), // April 2026
    selectedDate: "2026-04-08",
    cropTemplates: [],
    plantingWindows: null,
    weather: null,
    gardenClimate: null,
    selectedCropName: "",
    selectedGardenRecord: undefined,
    ...overrides,
  };
}

describe("useDerivedGardenState", () => {
  describe("calendarEvents", () => {
    it("maps tasks to calendar events with kind=task", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Water plants", due_on: "2026-04-10", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ tasks })));
      const taskEvent = result.current.calendarEvents.find((e) => e.kind === "task");
      expect(taskEvent).toBeDefined();
      expect(taskEvent?.id).toBe("task-1");
      expect(taskEvent?.title).toBe("Water plants");
      expect(taskEvent?.date).toBe("2026-04-10");
    });

    it("maps plantings to planting + harvest calendar events", () => {
      const plantings: Planting[] = [
        {
          id: 5,
          garden_id: 1,
          bed_id: 1,
          crop_name: "Basil",
          grid_x: 0,
          grid_y: 0,
          color: "#57a773",
          planted_on: "2026-04-01",
          expected_harvest_on: "2026-06-01",
          method: "direct_seed",
          location: "in_bed",
          moved_on: null,
          source: "manual",
          harvested_on: null,
          yield_notes: "",
        },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ plantings })));
      const plantEvent = result.current.calendarEvents.find((e) => e.id === "planting-5");
      const harvestEvent = result.current.calendarEvents.find((e) => e.id === "harvest-5");
      expect(plantEvent?.kind).toBe("planting");
      expect(plantEvent?.title).toBe("Plant Basil");
      expect(harvestEvent?.kind).toBe("harvest");
      expect(harvestEvent?.title).toBe("Harvest Basil");
    });

    it("returns empty array when no tasks or plantings", () => {
      const { result } = renderHook(() => useDerivedGardenState(defaultParams()));
      expect(result.current.calendarEvents).toHaveLength(0);
    });
  });

  describe("eventsByDate", () => {
    it("groups events by their date key", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Task A", due_on: "2026-04-10", is_done: false, notes: "" },
        { id: 2, garden_id: 1, planting_id: null, title: "Task B", due_on: "2026-04-10", is_done: false, notes: "" },
        { id: 3, garden_id: 1, planting_id: null, title: "Task C", due_on: "2026-04-11", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ tasks })));
      expect(result.current.eventsByDate.get("2026-04-10")).toHaveLength(2);
      expect(result.current.eventsByDate.get("2026-04-11")).toHaveLength(1);
    });
  });

  describe("monthCells", () => {
    it("always returns exactly 42 cells", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ monthCursor: new Date(2026, 3, 1) })),
      );
      expect(result.current.monthCells).toHaveLength(42);
    });

    it("starts the grid on the correct Monday-offset day for April 2026", () => {
      // April 2026 starts on Wednesday. Monday-anchored grid → offset 2 → first cell is March 30
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ monthCursor: new Date(2026, 3, 1) })),
      );
      const firstCell = result.current.monthCells[0];
      expect(firstCell.getMonth()).toBe(2); // March
      expect(firstCell.getDate()).toBe(30);
    });
  });

  describe("cropMap and selectedCrop", () => {
    it("builds a map from crop name to template", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ cropTemplates: [sampleCrop] })),
      );
      expect(result.current.cropMap.get("Tomato")).toBe(sampleCrop);
    });

    it("returns undefined for selectedCrop when name is not in map", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ cropTemplates: [], selectedCropName: "Pepper" })),
      );
      expect(result.current.selectedCrop).toBeUndefined();
    });

    it("returns the matching template for selectedCrop", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ cropTemplates: [sampleCrop], selectedCropName: "Tomato" })),
      );
      expect(result.current.selectedCrop).toBe(sampleCrop);
    });
  });

  describe("selectedCropWindow", () => {
    const windows: GardenClimatePlantingWindows = {
      generated_on: "2026-04-01",
      zone: "6a",
      microclimate_band: "mid",
      adjusted_last_spring_frost: "2026-05-01",
      adjusted_first_fall_frost: "2026-10-01",
      soil_temperature_estimate_f: 55,
      frost_risk_next_10_days: "low",
      windows: [
        {
          crop_template_id: 1,
          crop_name: "Tomato",
          variety: "",
          method: "transplant",
          window_start: "2026-05-15",
          window_end: "2026-06-15",
          status: "upcoming",
          reason: "",
          soil_temperature_min_f: 55,
          indoor_seed_start: null,
          indoor_seed_end: null,
          legacy_window_label: "",
        },
      ],
    };

    it("returns undefined when plantingWindows is null", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ plantingWindows: null, selectedCropName: "Tomato" })),
      );
      expect(result.current.selectedCropWindow).toBeUndefined();
    });

    it("returns undefined when selectedCropName is empty", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ plantingWindows: windows, selectedCropName: "" })),
      );
      expect(result.current.selectedCropWindow).toBeUndefined();
    });

    it("returns the matching window for the selected crop", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ plantingWindows: windows, selectedCropName: "Tomato" })),
      );
      expect(result.current.selectedCropWindow?.status).toBe("upcoming");
    });
  });

  describe("pendingTasks, homeTaskPreview, overdueTaskCount, upcomingTaskCount", () => {
    const today = "2026-04-08";

    it("filters out completed tasks from pendingTasks", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Done", due_on: "2026-04-05", is_done: true, notes: "" },
        { id: 2, garden_id: 1, planting_id: null, title: "Pending", due_on: "2026-04-10", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ today, tasks })));
      expect(result.current.pendingTasks).toHaveLength(1);
      expect(result.current.pendingTasks[0].title).toBe("Pending");
    });

    it("sorts pending tasks by due_on ascending", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Late", due_on: "2026-04-20", is_done: false, notes: "" },
        { id: 2, garden_id: 1, planting_id: null, title: "Early", due_on: "2026-04-09", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ today, tasks })));
      expect(result.current.pendingTasks[0].title).toBe("Early");
      expect(result.current.pendingTasks[1].title).toBe("Late");
    });

    it("homeTaskPreview returns at most 4 tasks from the current week scope", () => {
      // today 2026-04-08 → week Mon 04-06 … Sun 04-12
      const daysInWeek = [6, 7, 8, 9, 10, 11];
      const tasks: Task[] = daysInWeek.map((day, i) => ({
        id: i + 1,
        garden_id: 1,
        planting_id: null,
        title: `Task ${i + 1}`,
        due_on: `2026-04-${String(day).padStart(2, "0")}`,
        is_done: false,
        notes: "",
      }));
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ today, tasks })));
      expect(result.current.homeTaskPreview).toHaveLength(4);
    });

    it("homeTaskPreview excludes tasks due after this calendar week", () => {
      const tasks: Task[] = [
        {
          id: 1,
          garden_id: 1,
          planting_id: null,
          title: "This week",
          due_on: "2026-04-10",
          is_done: false,
          notes: "",
        },
        {
          id: 2,
          garden_id: 1,
          planting_id: null,
          title: "Next week",
          due_on: "2026-04-15",
          is_done: false,
          notes: "",
        },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ today, tasks })));
      expect(result.current.homeTaskPreview.map((t) => t.title)).toEqual(["This week"]);
    });

    it("counts overdue tasks (due_on < today)", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Overdue", due_on: "2026-04-01", is_done: false, notes: "" },
        { id: 2, garden_id: 1, planting_id: null, title: "Today", due_on: "2026-04-08", is_done: false, notes: "" },
        { id: 3, garden_id: 1, planting_id: null, title: "Future", due_on: "2026-04-15", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ today, tasks })));
      expect(result.current.overdueTaskCount).toBe(1);
      expect(result.current.upcomingTaskCount).toBe(2);
    });
  });

  describe("getLocalIsoWeekRange", () => {
    it("returns Monday–Sunday bounds for a Wednesday", () => {
      expect(getLocalIsoWeekRange("2026-04-08")).toEqual({ start: "2026-04-06", end: "2026-04-12" });
    });
  });

  describe("weatherPreview", () => {
    it("returns empty array when weather is null", () => {
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather: null })));
      expect(result.current.weatherPreview).toHaveLength(0);
    });

    it("returns empty array when weather has no daily data", () => {
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather: {} })));
      expect(result.current.weatherPreview).toHaveLength(0);
    });

    it("returns the first 3 days of weather data", () => {
      const weather = {
        daily: {
          time: ["2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11"],
          temperature_2m_min: [40, 42, 38, 45],
          temperature_2m_max: [65, 70, 60, 75],
          precipitation_sum: [0, 0.1, 0.5, 0],
        },
      };
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather })));
      expect(result.current.weatherPreview).toHaveLength(3);
      expect(result.current.weatherPreview[0]).toEqual({ date: "2026-04-08", low: 40, high: 65, rain: 0 });
    });
  });

  describe("actionablePlantingWindows", () => {
    it("returns empty array when plantingWindows is null", () => {
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ plantingWindows: null })));
      expect(result.current.actionablePlantingWindows).toHaveLength(0);
    });

    it("filters to actionable statuses and sorts by priority", () => {
      const plantingWindows: GardenClimatePlantingWindows = {
        generated_on: "2026-04-01",
        zone: "6a",
        microclimate_band: "mid",
        adjusted_last_spring_frost: "2026-05-01",
        adjusted_first_fall_frost: "2026-10-01",
        soil_temperature_estimate_f: 55,
        frost_risk_next_10_days: "low",
        windows: [
          { crop_template_id: 1, crop_name: "Lettuce", variety: "", method: "direct_sow", window_start: "", window_end: "", status: "watch", reason: "", soil_temperature_min_f: 40, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "" },
          { crop_template_id: 2, crop_name: "Tomato", variety: "", method: "transplant", window_start: "", window_end: "", status: "open", reason: "", soil_temperature_min_f: 55, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "" },
          { crop_template_id: 3, crop_name: "Pepper", variety: "", method: "transplant", window_start: "", window_end: "", status: "wait", reason: "", soil_temperature_min_f: 60, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "" },
          { crop_template_id: 4, crop_name: "Squash", variety: "", method: "direct_sow", window_start: "", window_end: "", status: "closing", reason: "", soil_temperature_min_f: 60, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "" },
        ],
      };
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ plantingWindows })));
      // wait is excluded; open, closing, watch returned in priority order; capped at 3
      const names = result.current.actionablePlantingWindows.map((w) => w.crop_name);
      expect(names).toEqual(["Tomato", "Squash", "Lettuce"]); // open, closing, watch
    });
  });

  describe("weatherRiskCues", () => {
    it("returns empty array when gardenClimate is null and weather is empty", () => {
      const { result } = renderHook(() => useDerivedGardenState(defaultParams()));
      expect(result.current.weatherRiskCues).toHaveLength(0);
    });

    it("adds frost risk cue when frost_risk_next_10_days is not low", () => {
      const gardenClimate = { frost_risk_next_10_days: "moderate" } as GardenClimate;
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ gardenClimate })));
      expect(result.current.weatherRiskCues.some((c) => c.includes("Frost risk"))).toBe(true);
    });

    it("does not add frost cue when frost_risk is low", () => {
      const gardenClimate = { frost_risk_next_10_days: "low" } as GardenClimate;
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ gardenClimate })));
      expect(result.current.weatherRiskCues.some((c) => c.includes("Frost risk"))).toBe(false);
    });

    it("adds heavy rain cue when precipitation >= 0.5", () => {
      const weather = {
        daily: {
          time: ["2026-04-08"],
          temperature_2m_min: [40],
          temperature_2m_max: [60],
          precipitation_sum: [0.6],
        },
      };
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather })));
      expect(result.current.weatherRiskCues.some((c) => c.includes("Heavy rain"))).toBe(true);
    });

    it("adds heat cue when high temperature >= 85", () => {
      const weather = {
        daily: {
          time: ["2026-04-08"],
          temperature_2m_min: [65],
          temperature_2m_max: [90],
          precipitation_sum: [0],
        },
      };
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather })));
      expect(result.current.weatherRiskCues.some((c) => c.includes("Heat"))).toBe(true);
    });

    it("caps weatherRiskCues at 3", () => {
      const gardenClimate = { frost_risk_next_10_days: "high" } as GardenClimate;
      const weather = {
        daily: {
          time: ["2026-04-08"],
          temperature_2m_min: [65],
          temperature_2m_max: [90],
          precipitation_sum: [0.7],
        },
      };
      const { result } = renderHook(() => useDerivedGardenState(defaultParams({ weather, gardenClimate })));
      expect(result.current.weatherRiskCues.length).toBeLessThanOrEqual(3);
    });
  });

  describe("selectedDayEvents, selectedGardenName, yardWidthFt, yardLengthFt", () => {
    it("returns events for the selectedDate", () => {
      const tasks: Task[] = [
        { id: 1, garden_id: 1, planting_id: null, title: "Today task", due_on: "2026-04-08", is_done: false, notes: "" },
      ];
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ tasks, selectedDate: "2026-04-08" })),
      );
      expect(result.current.selectedDayEvents).toHaveLength(1);
    });

    it("returns empty array for a date with no events", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ selectedDate: "2026-04-08" })),
      );
      expect(result.current.selectedDayEvents).toHaveLength(0);
    });

    it("returns selectedGardenName from selectedGardenRecord", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ selectedGardenRecord: sampleGarden })),
      );
      expect(result.current.selectedGardenName).toBe("Test Garden");
    });

    it("uses garden dimensions when selectedGardenRecord is provided", () => {
      const garden = { ...sampleGarden, yard_width_ft: 40, yard_length_ft: 50 };
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ selectedGardenRecord: garden })),
      );
      expect(result.current.yardWidthFt).toBe(40);
      expect(result.current.yardLengthFt).toBe(50);
    });

    it("defaults to 20x20 when selectedGardenRecord is undefined", () => {
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ selectedGardenRecord: undefined })),
      );
      expect(result.current.yardWidthFt).toBe(20);
      expect(result.current.yardLengthFt).toBe(20);
    });

    it("enforces minimum yard size of 4", () => {
      const garden = { ...sampleGarden, yard_width_ft: 2, yard_length_ft: 3 };
      const { result } = renderHook(() =>
        useDerivedGardenState(defaultParams({ selectedGardenRecord: garden })),
      );
      expect(result.current.yardWidthFt).toBe(4);
      expect(result.current.yardLengthFt).toBe(4);
    });
  });
});
