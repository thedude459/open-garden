import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MicroclimateProfileCard } from "./MicroclimateProfileCard";
import type { Garden, GardenClimate } from "../types";
import type { MicroclimateFormState, MicroclimateSuggestion } from "../app/types";

const sampleGarden: Garden = {
  id: 1,
  name: "My Garden",
  description: "",
  zip_code: "90210",
  growing_zone: "10a",
  yard_width_ft: 30,
  yard_length_ft: 40,
  latitude: 34.09,
  longitude: -118.41,
  orientation: "south",
  sun_exposure: "full_sun",
  wind_exposure: "sheltered",
  thermal_mass: "low",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  is_shared: false,
  edge_buffer_in: 6,
};

const sampleDraft: MicroclimateFormState = {
  orientation: "south",
  sun_exposure: "full_sun",
  wind_exposure: "sheltered",
  thermal_mass: "low",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  edge_buffer_in: 6,
};

const sampleClimate: GardenClimate = {
  zone: "10a",
  microclimate_band: "Warm",
  baseline_last_spring_frost: "Feb 15",
  adjusted_last_spring_frost: "Feb 10",
  baseline_first_fall_frost: "Dec 1",
  adjusted_first_fall_frost: "Dec 5",
  last_frost_shift_days: -5,
  first_fall_shift_days: 4,
  soil_temperature_estimate_f: 68,
  soil_temperature_status: "optimal",
  frost_risk_next_10_days: "none",
  next_frost_date: null,
  growing_season_days: 300,
  factors: [],
  recommendations: [],
  forecast: [],
};

const sampleSuggestion: MicroclimateSuggestion = {
  sun_exposure: { value: "full_sun", note: "Open sky detected" },
  wind_exposure: { value: null, note: "Check for windbreaks" },
  slope_position: { value: "mid", note: "Moderate slope" },
  frost_pocket_risk: { value: "low", note: "Low risk noted" },
  orientation: { value: null, note: "Use satellite to confirm" },
  thermal_mass: { value: null, note: "Look for pavement" },
};

function defaultProps(overrides: Partial<Parameters<typeof MicroclimateProfileCard>[0]> = {}) {
  return {
    selectedGardenRecord: sampleGarden,
    gardenClimate: null,
    isLoadingClimate: false,
    microclimateDraft: sampleDraft,
    setMicroclimateDraft: vi.fn(),
    microclimateSuggestion: null,
    isGeocodingAddress: false,
    isSuggestingMicroclimate: false,
    onSubmit: vi.fn((e) => e.preventDefault()),
    onGeocode: vi.fn(),
    onSuggest: vi.fn(),
    ...overrides,
  };
}

describe("MicroclimateProfileCard", () => {
  it("renders Climate and Site Profile heading", () => {
    render(<MicroclimateProfileCard {...defaultProps()} />);
    expect(screen.getByText("Climate and Site Profile")).toBeInTheDocument();
  });

  it("shows gardenClimate band badge when gardenClimate is provided", () => {
    render(<MicroclimateProfileCard {...defaultProps({ gardenClimate: sampleClimate })} />);
    expect(screen.getByText("Warm")).toBeInTheDocument();
  });

  it("shows adjusted frost dates when gardenClimate is provided", () => {
    render(<MicroclimateProfileCard {...defaultProps({ gardenClimate: sampleClimate })} />);
    expect(screen.getByText("Feb 10")).toBeInTheDocument();
    expect(screen.getByText("Dec 5")).toBeInTheDocument();
    expect(screen.getByText("68F")).toBeInTheDocument();
  });

  it("does not show frost date section when gardenClimate is null", () => {
    render(<MicroclimateProfileCard {...defaultProps({ gardenClimate: null })} />);
    expect(screen.queryByText(/adjusted last spring frost/i)).not.toBeInTheDocument();
  });

  it("calls setMicroclimateDraft when compass N button is clicked", () => {
    const setMicroclimateDraft = vi.fn();
    render(<MicroclimateProfileCard {...defaultProps({ setMicroclimateDraft })} />);
    fireEvent.click(screen.getByTitle("North-facing"));
    expect(setMicroclimateDraft).toHaveBeenCalledWith(expect.any(Function));
  });

  it("calls setMicroclimateDraft when sun exposure select changes", () => {
    const setMicroclimateDraft = vi.fn();
    render(<MicroclimateProfileCard {...defaultProps({ setMicroclimateDraft })} />);
    fireEvent.change(screen.getByLabelText(/sun exposure/i), { target: { value: "part_sun" } });
    expect(setMicroclimateDraft).toHaveBeenCalledWith(expect.any(Function));
  });

  it("calls setMicroclimateDraft when edge buffer input changes", () => {
    const setMicroclimateDraft = vi.fn();
    render(<MicroclimateProfileCard {...defaultProps({ setMicroclimateDraft })} />);
    fireEvent.change(screen.getByLabelText(/bed edge buffer/i), { target: { value: "9" } });
    expect(setMicroclimateDraft).toHaveBeenCalledWith(expect.any(Function));
  });

  it("shows suggestion notes when microclimateSuggestion is provided", () => {
    render(<MicroclimateProfileCard {...defaultProps({ microclimateSuggestion: sampleSuggestion })} />);
    expect(screen.getByText(/open sky detected/i)).toBeInTheDocument();
    expect(screen.getByText(/use satellite to confirm/i)).toBeInTheDocument();
  });

  it("calls onSubmit when form is submitted", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<MicroclimateProfileCard {...defaultProps({ onSubmit })} />);
    fireEvent.submit(screen.getByRole("button", { name: /save climate profile/i }).closest("form")!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("calls onSuggest when Suggest microclimate button is clicked", () => {
    const onSuggest = vi.fn();
    render(<MicroclimateProfileCard {...defaultProps({ onSuggest })} />);
    fireEvent.click(screen.getByRole("button", { name: /suggest from location/i }));
    expect(onSuggest).toHaveBeenCalled();
  });

  it("calls onGeocode when Geocode address button is clicked", () => {
    const onGeocode = vi.fn();
    // The geocode button only renders when address_private is non-empty
    render(
      <MicroclimateProfileCard
        {...defaultProps({
          onGeocode,
          microclimateDraft: { ...sampleDraft, address_private: "123 Main St" },
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /refine location from address/i }));
    expect(onGeocode).toHaveBeenCalled();
  });

  it("shows loading message when isLoadingClimate is true", () => {
    render(<MicroclimateProfileCard {...defaultProps({ isLoadingClimate: true })} />);
    expect(screen.getByText(/refreshing climate guidance/i)).toBeInTheDocument();
  });
});
