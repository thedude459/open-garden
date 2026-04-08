import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateGardenForm } from "./CreateGardenForm";
import { GardenListSidebar } from "./GardenListSidebar";
import { HomeHero } from "./HomeHero";
import { MicroclimateProfileCard } from "./MicroclimateProfileCard";
import { Garden, GardenClimate, Task } from "../types";
import { MicroclimateSuggestion } from "../app/types";

afterEach(() => {
  cleanup();
});

const garden: Garden = {
  id: 1,
  name: "Backyard",
  description: "Main garden",
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
  address_private: "123 Garden Lane",
  is_shared: false,
  edge_buffer_in: 6,
};

const climate: GardenClimate = {
  zone: "6a",
  microclimate_band: "warm pocket",
  baseline_last_spring_frost: "2026-05-01",
  adjusted_last_spring_frost: "2026-04-24",
  baseline_first_fall_frost: "2026-10-10",
  adjusted_first_fall_frost: "2026-10-20",
  last_frost_shift_days: -7,
  first_fall_shift_days: 10,
  soil_temperature_estimate_f: 61,
  soil_temperature_status: "warm",
  frost_risk_next_10_days: "low",
  next_frost_date: null,
  growing_season_days: 180,
  factors: [],
  recommendations: [{ key: "water", title: "Water lightly", status: "open", detail: "Rain is coming." }],
  forecast: [],
};

const suggestion: MicroclimateSuggestion = {
  orientation: { value: null, note: "Use the compass based on your lot orientation." },
  sun_exposure: { value: "full_sun", note: "Detected a high-sun exposure area." },
  wind_exposure: { value: "moderate", note: "Shelter from nearby fencing moderates wind." },
  thermal_mass: { value: null, note: "Check nearby hardscape for stored heat." },
  slope_position: { value: "mid", note: "The yard appears mid-slope." },
  frost_pocket_risk: { value: "low", note: "Cold air drainage looks limited." },
};

describe("HomeHero", () => {
  it("renders populated garden dashboard content and navigation actions", () => {
    const onNavigate = vi.fn();
    const tasks: Task[] = [
      { id: 1, garden_id: 1, planting_id: null, title: "Weed tomatoes", due_on: "2026-04-05", is_done: false, notes: "" },
    ];

    render(
      <HomeHero
        garden={garden}
        beds={[{ id: 1 }]}
        placements={[{ id: 2 }]}
        tasks={tasks}
        cropTemplateCount={5}
        gardenClimate={climate}
        homeTaskPreview={tasks}
        overdueTaskCount={1}
        upcomingTaskCount={3}
        weatherPreview={[{ date: "2026-04-04", low: 40, high: 62, rain: 0.1 }]}
        isLoadingWeather={false}
        actionablePlantingWindows={[{ crop_template_id: 1, crop_name: "Pea", variety: "", method: "direct", window_start: "2026-04-01", window_end: "2026-04-15", status: "open", reason: "Good timing", soil_temperature_min_f: 45, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "Spring" }]}
        weatherRiskCues={["Cover seedlings on Tuesday night."]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Bed Planner" }));
    fireEvent.click(screen.getByRole("button", { name: "Manage Crops" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule planting" }));
    fireEvent.click(screen.getByRole("button", { name: "Plan protection task" }));

    expect(screen.getByText("Backyard")).toBeInTheDocument();
    expect(screen.getByText("Weed tomatoes")).toBeInTheDocument();
    expect(screen.getByText(/Cover seedlings on Tuesday night/i)).toBeInTheDocument();
    expect(screen.getByText("Act now")).toBeInTheDocument();
    expect(screen.getByText("Watch soon")).toBeInTheDocument();
    expect(screen.getByTitle("Planting cue")).toBeInTheDocument();
    expect(screen.getByTitle("Protection cue")).toBeInTheDocument();
    expect(onNavigate).toHaveBeenNthCalledWith(1, "calendar");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "planner");
    expect(onNavigate).toHaveBeenNthCalledWith(3, "crops");
    expect(onNavigate).toHaveBeenNthCalledWith(4, "calendar");
    expect(onNavigate).toHaveBeenNthCalledWith(5, "calendar");
  });

  it("renders empty-state guidance when there are no pending tasks or forecast entries", () => {
    render(
      <HomeHero
        garden={garden}
        beds={[]}
        placements={[]}
        tasks={[]}
        cropTemplateCount={0}
        gardenClimate={null}
        homeTaskPreview={[]}
        overdueTaskCount={0}
        upcomingTaskCount={0}
        weatherPreview={[]}
        isLoadingWeather={false}
        actionablePlantingWindows={[]}
        weatherRiskCues={[]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/No open tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/No weather data loaded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No urgent planting windows yet/i)).toBeInTheDocument();
  });

  it("limits weather and cue previews to three and expands with view-all controls", () => {
    render(
      <HomeHero
        garden={garden}
        beds={[]}
        placements={[]}
        tasks={[]}
        cropTemplateCount={0}
        gardenClimate={climate}
        homeTaskPreview={[]}
        overdueTaskCount={0}
        upcomingTaskCount={0}
        weatherPreview={[
          { date: "2026-04-07", low: 40, high: 60, rain: 0 },
          { date: "2026-04-08", low: 42, high: 61, rain: 0.1 },
          { date: "2026-04-09", low: 43, high: 62, rain: 0.2 },
          { date: "2026-04-10", low: 44, high: 63, rain: 0.3 },
        ]}
        isLoadingWeather={false}
        actionablePlantingWindows={[
          { crop_template_id: 1, crop_name: "Pea", variety: "", method: "direct", window_start: "2026-04-07", window_end: "2026-04-14", status: "open", reason: "Soil is ready.", soil_temperature_min_f: 45, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "Spring" },
          { crop_template_id: 2, crop_name: "Carrot", variety: "", method: "direct", window_start: "2026-04-09", window_end: "2026-04-15", status: "watch", reason: "Watch moisture.", soil_temperature_min_f: 45, indoor_seed_start: null, indoor_seed_end: null, legacy_window_label: "Spring" },
        ]}
        weatherRiskCues={[
          "Cover seedlings tonight.",
          "Prepare row covers for wind.",
        ]}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.queryByText("2026-04-10")).not.toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(/Confidence improves as local forecast/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all forecast days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all cues" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View all forecast days" }));
    fireEvent.click(screen.getByRole("button", { name: "View all cues" }));

    expect(screen.getByText("2026-04-10", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Prepare row covers for wind/i)).toBeInTheDocument();
    expect(screen.getAllByText("Watch soon").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Schedule planting" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Review in planner" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Plan protection task" }).length).toBeGreaterThan(0);
  });
});

describe("CreateGardenForm", () => {
  it("surfaces validation and forwards field updates", () => {
    const setGardenDraft = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <CreateGardenForm
        gardenDraft={{
          name: "",
          description: "",
          zip_code: "",
          yard_width_ft: 10,
          yard_length_ft: 20,
          address_private: "",
          is_shared: false,
        }}
        setGardenDraft={setGardenDraft}
        showGardenValidation
        gardenFormErrors={{ name: "Name required", zip_code: "ZIP required", yard_width_ft: "Too small", yard_length_ft: "Too short" }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Garden Name"), { target: { value: "Front Yard" } });
    fireEvent.change(screen.getByLabelText("ZIP Code"), { target: { value: "80301" } });
    fireEvent.change(screen.getByLabelText("Yard Width (ft)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Yard Length (ft)"), { target: { value: "24" } });
    fireEvent.click(screen.getByText("Advanced options"));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Sunny" } });
    fireEvent.change(screen.getByLabelText("Private Address"), { target: { value: "123 Lane" } });
    fireEvent.click(screen.getByLabelText("Share publicly"));
    fireEvent.submit(screen.getByRole("button", { name: "Create garden" }).closest("form") as HTMLFormElement);

    expect(screen.getByText("Name required")).toBeInTheDocument();
    expect(screen.getByText("ZIP required")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(setGardenDraft).toHaveBeenCalledTimes(7);
  });
});

describe("GardenListSidebar", () => {
  it("supports garden selection and deletion", () => {
    const onSelectGarden = vi.fn();
    const onDeleteGarden = vi.fn();

    render(
      <GardenListSidebar
        gardens={[garden]}
        publicGardens={[{ ...garden, id: 2, name: "Community Plot", is_shared: true }]}
        selectedGarden={1}
        onSelectGarden={onSelectGarden}
        onDeleteGarden={onDeleteGarden}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select garden Backyard" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Backyard" }));

    expect(onSelectGarden).toHaveBeenCalledWith(1);
    expect(onDeleteGarden).toHaveBeenCalledWith(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Community Plot")).toBeInTheDocument();
  });

  it("renders empty-state guidance when there are no gardens yet", () => {
    render(
      <GardenListSidebar
        gardens={[]}
        publicGardens={[]}
        selectedGarden={null}
        onSelectGarden={vi.fn()}
        onDeleteGarden={vi.fn()}
      />,
    );

    expect(screen.getByText(/Create a garden with your ZIP/i)).toBeInTheDocument();
    expect(screen.getByText(/No shared gardens yet/i)).toBeInTheDocument();
  });
});

describe("MicroclimateProfileCard", () => {
  it("renders climate details and forwards profile actions", () => {
    const setMicroclimateDraft = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onGeocode = vi.fn();
    const onSuggest = vi.fn();

    render(
      <MicroclimateProfileCard
        selectedGardenRecord={garden}
        gardenClimate={climate}
        isLoadingClimate={false}
        microclimateDraft={{
          orientation: "south",
          sun_exposure: "full_sun",
          wind_exposure: "moderate",
          thermal_mass: "moderate",
          slope_position: "mid",
          frost_pocket_risk: "low",
          address_private: "123 Garden Lane",
          edge_buffer_in: 6,
        }}
        setMicroclimateDraft={setMicroclimateDraft}
        microclimateSuggestion={suggestion}
        isGeocodingAddress={false}
        isSuggestingMicroclimate={false}
        onSubmit={onSubmit}
        onGeocode={onGeocode}
        onSuggest={onSuggest}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "N" }));
    fireEvent.change(screen.getByLabelText("Sun Exposure"), { target: { value: "part_sun" } });
    fireEvent.click(screen.getByRole("button", { name: /Suggest from location/i }));
    fireEvent.click(screen.getByRole("button", { name: /Refine location from address/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Save climate profile" }).closest("form") as HTMLFormElement);

    expect(screen.getByText(/Adjusted last spring frost/i)).toBeInTheDocument();
    expect(screen.getByText(/Use the compass based on your lot orientation/i)).toBeInTheDocument();
    expect(onSuggest).toHaveBeenCalledTimes(1);
    expect(onGeocode).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const orientationUpdater = setMicroclimateDraft.mock.calls[0][0] as (draft: Parameters<typeof MicroclimateProfileCard>[0]["microclimateDraft"]) => Parameters<typeof MicroclimateProfileCard>[0]["microclimateDraft"];
    expect(orientationUpdater({ orientation: "south", sun_exposure: "full_sun", wind_exposure: "moderate", thermal_mass: "moderate", slope_position: "mid", frost_pocket_risk: "low", address_private: "", edge_buffer_in: 6 }).orientation).toBe("north");
  });

  it("shows baseline hints when no suggestion or climate data is available", () => {
    render(
      <MicroclimateProfileCard
        selectedGardenRecord={{ ...garden, latitude: 0 }}
        gardenClimate={null}
        isLoadingClimate
        microclimateDraft={{
          orientation: "south",
          sun_exposure: "full_sun",
          wind_exposure: "moderate",
          thermal_mass: "moderate",
          slope_position: "mid",
          frost_pocket_risk: "low",
          address_private: "",
          edge_buffer_in: 6,
        }}
        setMicroclimateDraft={vi.fn()}
        microclimateSuggestion={null}
        isGeocodingAddress={false}
        isSuggestingMicroclimate={false}
        onSubmit={vi.fn()}
        onGeocode={vi.fn()}
        onSuggest={vi.fn()}
      />,
    );

    expect(screen.getByText(/Refreshing climate guidance/i)).toBeInTheDocument();
    expect(screen.getByText(/south-facing gets the most sun/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suggest from location/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refine location from address/i })).not.toBeInTheDocument();
  });
});