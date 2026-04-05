import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomePageSection } from "./HomePageSection";

vi.mock("./HomeHero", () => ({
  HomeHero: ({ onNavigate }: { onNavigate: (page: string) => void }) => (
    <button onClick={() => onNavigate("calendar")}>Go Calendar</button>
  ),
}));

vi.mock("./GardenListSidebar", () => ({
  GardenListSidebar: ({ onSelectGarden }: { onSelectGarden: (id: number) => void }) => (
    <button onClick={() => onSelectGarden(2)}>Select Garden 2</button>
  ),
}));

vi.mock("./CreateGardenForm", () => ({
  CreateGardenForm: () => <div>Create Form</div>,
}));

vi.mock("./MicroclimateProfileCard", () => ({
  MicroclimateProfileCard: () => <div>Microclimate Card</div>,
}));

afterEach(() => {
  cleanup();
});

function baseProps(): Parameters<typeof HomePageSection>[0] {
  return {
    selectedGarden: 1,
    selectedGardenRecord: {
      id: 1,
      name: "Backyard",
      description: "",
      zip_code: "80301",
      growing_zone: "6a",
      yard_width_ft: 20,
      yard_length_ft: 20,
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
    },
    gardens: [],
    publicGardens: [],
    beds: [],
    placements: [],
    cropTemplatesCount: 0,
    gardenClimate: null,
    isLoadingWeather: false,
    isLoadingClimate: false,
    derived: {
      homeTaskPreview: [],
      overdueTaskCount: 0,
      upcomingTaskCount: 0,
      weatherPreview: null,
      actionablePlantingWindows: [],
      weatherRiskCues: [],
    },
    taskActions: { tasks: [] },
    gardenActions: {
      gardenDraft: {},
      setGardenDraft: vi.fn(),
      showGardenValidation: false,
      gardenFormErrors: {},
      createGarden: vi.fn(),
      microclimateDraft: {},
      setMicroclimateDraft: vi.fn(),
      microclimateSuggestion: null,
      isGeocodingAddress: false,
      isSuggestingMicroclimate: false,
      saveMicroclimateProfile: vi.fn(),
      geocodeGardenAddress: vi.fn(),
      suggestMicroclimateProfile: vi.fn(),
    },
    plannerActions: { deleteGarden: vi.fn(async () => undefined) },
    setSelectedGarden: vi.fn(),
    onNavigate: vi.fn(),
  } as unknown as Parameters<typeof HomePageSection>[0];
}

describe("HomePageSection", () => {
  it("supports home hero and sidebar navigation flows", () => {
    const props = baseProps();
    render(<HomePageSection {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Go Calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Garden 2" }));

    expect(props.onNavigate).toHaveBeenCalledWith("calendar");
    expect(props.setSelectedGarden).toHaveBeenCalledWith(2);
  });

  it("hides hero when no garden is selected", () => {
    const props = baseProps();
    props.selectedGarden = null;
    props.selectedGardenRecord = undefined;

    render(<HomePageSection {...props} />);

    expect(screen.queryByRole("button", { name: "Go Calendar" })).not.toBeInTheDocument();
    expect(screen.getByText("Create Form")).toBeInTheDocument();
  });
});
