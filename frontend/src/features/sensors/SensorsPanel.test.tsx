import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SensorsPanel } from "./SensorsPanel";
import type { Bed, GardenSensorsSummary } from "../types";

const sampleBed: Bed = {
  id: 1,
  garden_id: 1,
  name: "Raised Bed A",
  width_in: 48,
  height_in: 96,
  grid_x: 0,
  grid_y: 0,
};

const sampleSummary: GardenSensorsSummary = {
  generated_at: "2026-04-09T00:00:00Z",
  garden_id: 1,
  horizon_hours: 24,
  sensors: [
    {
      id: 5,
      garden_id: 1,
      name: "Bed A Probe",
      sensor_kind: "soil_moisture",
      unit: "%",
      location_label: "Center",
      hardware_id: "hw-001",
      bed_id: 1,
      is_active: true,
      created_at: "2026-04-01T00:00:00Z",
      latest_value: 42,
      latest_captured_at: "2026-04-09T00:00:00Z",
    },
  ],
  irrigation_suggestions: [
    {
      title: "Water Raised Bed A",
      status: "needs_water",
      detail: "Moisture below threshold",
    },
  ],
  soil_moisture_series: [],
  soil_temperature_series: [],
};

function defaultProps(overrides: Partial<Parameters<typeof SensorsPanel>[0]> = {}) {
  return {
    selectedGardenName: "My Garden",
    beds: [],
    summary: null,
    isLoading: false,
    onRefresh: vi.fn(),
    onRegisterSensor: vi.fn().mockResolvedValue(undefined),
    onIngestReading: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("SensorsPanel", () => {
  it("renders Sensor Dashboard heading", () => {
    render(<SensorsPanel {...defaultProps()} />);
    expect(screen.getByText(/sensor dashboard/i)).toBeInTheDocument();
  });

  it("shows loading hint when isLoading is true", () => {
    render(<SensorsPanel {...defaultProps({ isLoading: true })} />);
    expect(screen.getByText(/loading sensor telemetry/i)).toBeInTheDocument();
  });

  it("shows 'No sensors registered yet' when summary is null", () => {
    render(<SensorsPanel {...defaultProps()} />);
    expect(screen.getByText(/no sensors registered yet/i)).toBeInTheDocument();
  });

  it("shows 'No irrigation guidance yet' when summary has no suggestions", () => {
    render(<SensorsPanel {...defaultProps()} />);
    expect(screen.getByText(/no irrigation guidance yet/i)).toBeInTheDocument();
  });

  it("calls onRefresh when Refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<SensorsPanel {...defaultProps({ onRefresh })} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders sensor list and irrigation suggestions from summary", () => {
    render(<SensorsPanel {...defaultProps({ summary: sampleSummary })} />);
    expect(screen.getByText("Bed A Probe")).toBeInTheDocument();
    expect(screen.getByText(/Water Raised Bed A/i)).toBeInTheDocument();
    expect(screen.getByText(/moisture below threshold/i)).toBeInTheDocument();
  });

  it("renders bed options in Register Sensor form", () => {
    render(<SensorsPanel {...defaultProps({ beds: [sampleBed] })} />);
    expect(screen.getByRole("option", { name: "Raised Bed A" })).toBeInTheDocument();
  });

  it("calls onRegisterSensor when the Register sensor form is submitted with a name", async () => {
    const onRegisterSensor = vi.fn().mockResolvedValue(undefined);
    render(<SensorsPanel {...defaultProps({ onRegisterSensor })} />);
    fireEvent.change(screen.getByPlaceholderText(/bed a moisture probe/i), { target: { value: "My Sensor" } });
    fireEvent.submit(screen.getByRole("button", { name: /register sensor/i }).closest("form")!);
    await waitFor(() =>
      expect(onRegisterSensor).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Sensor" }),
      ),
    );
  });

  it("updates unit automatically when sensor kind changes to soil_temperature", () => {
    render(<SensorsPanel {...defaultProps()} />);
    // Sensor kind select contains "Soil moisture" option; find it by its displayed text
    const kindSel = screen
      .getAllByRole("combobox")
      .find((el) =>
        Array.from(el.querySelectorAll("option")).some(
          (o) => (o as HTMLOptionElement).value === "soil_moisture",
        ),
      )!;
    fireEvent.change(kindSel, { target: { value: "soil_temperature" } });
    // Unit field should now show "F"
    expect(screen.getByDisplayValue("F")).toBeInTheDocument();
  });

  it("calls onIngestReading when Push reading form is submitted with a sensor selected", async () => {
    const onIngestReading = vi.fn().mockResolvedValue(undefined);
    render(<SensorsPanel {...defaultProps({ summary: sampleSummary, onIngestReading })} />);
    // Select the sensor in the ingest select
    const ingestSelect = screen.getByRole("option", { name: /bed a probe/i }).closest("select")!;
    fireEvent.change(ingestSelect, { target: { value: "5" } });
    // Change reading value
    const valueInput = screen.getByRole("spinbutton");
    fireEvent.change(valueInput, { target: { value: "55" } });
    fireEvent.submit(screen.getByRole("button", { name: /push reading/i }).closest("form")!);
    await waitFor(() => expect(onIngestReading).toHaveBeenCalledWith(5, 55));
  });
});
