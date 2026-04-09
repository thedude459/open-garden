import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerPlacementTools } from "./PlannerPlacementTools";
import type { Bed, ClimatePlantingWindow, CropTemplate } from "../types";

const sampleCrop: CropTemplate = {
  id: 1,
  name: "Tomato",
  variety: "Roma",
  source: "manual",
  source_url: "",
  image_url: "",
  external_product_id: "",
  family: "Solanaceae",
  spacing_in: 18,
  row_spacing_in: 36,
  in_row_spacing_in: 18,
  days_to_harvest: 70,
  planting_window: "Late spring",
  direct_sow: false,
  frost_hardy: false,
  weeks_to_transplant: 6,
  notes: "Keep well watered.",
};

const sampleBed: Bed = {
  id: 1,
  garden_id: 1,
  name: "North Bed",
  width_in: 48,
  height_in: 96,
  grid_x: 0,
  grid_y: 0,
};

function defaultProps(overrides: Partial<Parameters<typeof PlannerPlacementTools>[0]> = {}) {
  return {
    cropSearchQuery: "",
    onCropSearchQueryChange: vi.fn(),
    onCropSearchKeyDown: vi.fn(),
    filteredCropTemplates: [],
    cropSearchActiveIndex: 0,
    selectedCropName: "",
    selectedCrop: undefined,
    selectedCropWindow: undefined,
    isLoadingPlantingWindows: false,
    onSelectCrop: vi.fn(),
    cropBaseName: (crop: CropTemplate) => crop.name,
    beds: [],
    placementBedId: null,
    onPlacementBedIdChange: vi.fn(),
    onGoToCrops: vi.fn(),
    ...overrides,
  };
}

describe("PlannerPlacementTools", () => {
  it("renders the search input and empty list message", () => {
    render(<PlannerPlacementTools {...defaultProps()} />);
    expect(screen.getByRole("combobox", { name: /search vegetable/i })).toBeInTheDocument();
    expect(screen.getByText("No vegetables match that search.")).toBeInTheDocument();
  });

  it("renders crop options from filteredCropTemplates", () => {
    render(<PlannerPlacementTools {...defaultProps({ filteredCropTemplates: [sampleCrop] })} />);
    expect(screen.getByRole("option", { name: /tomato/i })).toBeInTheDocument();
  });

  it("calls onCropSearchQueryChange when typing in search", () => {
    const onCropSearchQueryChange = vi.fn();
    render(<PlannerPlacementTools {...defaultProps({ onCropSearchQueryChange })} />);
    fireEvent.change(screen.getByRole("combobox", { name: /search vegetable/i }), { target: { value: "tom" } });
    expect(onCropSearchQueryChange).toHaveBeenCalledWith("tom");
  });

  it("calls onSelectCrop when a crop option is clicked", () => {
    const onSelectCrop = vi.fn();
    render(
      <PlannerPlacementTools {...defaultProps({ filteredCropTemplates: [sampleCrop], onSelectCrop })} />,
    );
    fireEvent.click(screen.getByRole("option", { name: /tomato/i }));
    expect(onSelectCrop).toHaveBeenCalledWith(sampleCrop);
  });

  it("renders selected crop card when selectedCrop is provided", () => {
    render(
      <PlannerPlacementTools {...defaultProps({ selectedCrop: sampleCrop, selectedCropName: "Tomato" })} />,
    );
    expect(screen.getByText(/spacing 18 in/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep well watered/i)).toBeInTheDocument();
    expect(screen.getByText(/start indoors 6 wks ahead/i)).toBeInTheDocument();
  });

  it("shows frost-hardy tag for frost-hardy crop", () => {
    const frostCrop = { ...sampleCrop, frost_hardy: true };
    render(<PlannerPlacementTools {...defaultProps({ selectedCrop: frostCrop, selectedCropName: "Kale" })} />);
    expect(screen.getByText("Frost hardy")).toBeInTheDocument();
  });

  it("shows direct-sow tag for direct-sow crop", () => {
    const directSowCrop = { ...sampleCrop, direct_sow: true };
    render(<PlannerPlacementTools {...defaultProps({ selectedCrop: directSowCrop, selectedCropName: "Radish" })} />);
    expect(screen.getByText("Direct sow")).toBeInTheDocument();
  });

  it("shows dynamic window when selectedCropWindow is provided", () => {
    const window: ClimatePlantingWindow = {
      crop_template_id: 1,
      crop_name: "Tomato",
      variety: "Roma",
      method: "transplant",
      window_start: "2025-05-01",
      window_end: "2025-06-15",
      status: "open",
      reason: "Soil is warm enough.",
      soil_temperature_min_f: 55,
      indoor_seed_start: "2025-03-01",
      indoor_seed_end: "2025-03-15",
      legacy_window_label: "Late spring",
    };
    render(
      <PlannerPlacementTools
        {...defaultProps({ selectedCrop: sampleCrop, selectedCropName: "Tomato", selectedCropWindow: window })}
      />,
    );
    expect(screen.getByText(/Dynamic window:/i)).toBeInTheDocument();
    expect(screen.getByText(/Indoor start:/i)).toBeInTheDocument();
    expect(screen.getByText("Soil is warm enough.")).toBeInTheDocument();
  });

  it("shows loading state when isLoadingPlantingWindows", () => {
    render(
      <PlannerPlacementTools
        {...defaultProps({ selectedCrop: sampleCrop, isLoadingPlantingWindows: true })}
      />,
    );
    expect(screen.getByText("Loading dynamic window...")).toBeInTheDocument();
  });

  it("renders bed options in the select dropdown", () => {
    render(<PlannerPlacementTools {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.getByRole("option", { name: "North Bed" })).toBeInTheDocument();
  });

  it("calls onPlacementBedIdChange when a bed is selected", () => {
    const onPlacementBedIdChange = vi.fn();
    render(
      <PlannerPlacementTools {...defaultProps({ beds: [sampleBed], onPlacementBedIdChange })} />,
    );
    // The <select> has "Apply to any bed" as its first option; use getByDisplayValue to find it
    const select = screen.getByDisplayValue("Apply to any bed") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "1" } });
    expect(onPlacementBedIdChange).toHaveBeenCalledWith(1);
  });

  it("calls onGoToCrops when the Manage Crop Library button is clicked", () => {
    const onGoToCrops = vi.fn();
    render(<PlannerPlacementTools {...defaultProps({ onGoToCrops })} />);
    fireEvent.click(screen.getByRole("button", { name: /manage crop library/i }));
    expect(onGoToCrops).toHaveBeenCalled();
  });
});
