import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SensorsPageSection } from "./SensorsPageSection";
import { Garden, GardenSensorsSummary } from "../types";

afterEach(() => {
  cleanup();
});

const garden: Garden = {
  id: 1,
  name: "Backyard",
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

const summary: GardenSensorsSummary = {
  generated_at: "2026-04-04T10:00:00Z",
  garden_id: 1,
  horizon_hours: 24,
  sensors: [{
    id: 11,
    garden_id: 1,
    bed_id: 1,
    name: "Probe 1",
    sensor_kind: "soil_moisture",
    unit: "%",
    location_label: "Bed A",
    hardware_id: "HW-1",
    is_active: true,
    created_at: "2026-04-01T00:00:00Z",
    latest_value: 41,
    latest_captured_at: "2026-04-04T09:00:00Z",
  }],
  soil_moisture_series: [{ sensor_id: 11, sensor_name: "Probe 1", captured_at: "2026-04-04T09:00:00Z", value: 41, unit: "%" }],
  soil_temperature_series: [{ sensor_id: 11, sensor_name: "Probe 1", captured_at: "2026-04-04T09:00:00Z", value: 62, unit: "F" }],
  irrigation_suggestions: [{ status: "open", title: "Water Bed A", detail: "Moisture is trending down." }],
};

describe("SensorsPageSection", () => {
  it("supports refresh, sensor registration, and reading ingestion", async () => {
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);
    const registerSensor = vi.fn(async () => undefined);
    const ingestSensorData = vi.fn(async () => undefined);

    render(
      <SensorsPageSection
        selectedGardenName="Backyard"
        selectedGardenRecord={garden}
        beds={[{ id: 1, garden_id: 1, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }]}
        summary={summary}
        isLoading={false}
        loadSensorSummaryForGarden={loadSensorSummaryForGarden}
        gardenActions={{ registerSensor, ingestSensorData }}
        pushNotice={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.change(screen.getByPlaceholderText("Bed A Moisture Probe"), { target: { value: "Probe 2" } });
    fireEvent.change(screen.getByPlaceholderText("Location label"), { target: { value: "Bed B" } });
    fireEvent.change(screen.getByPlaceholderText("Hardware ID (optional)"), { target: { value: "HW-2" } });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Register sensor" }).closest("form") as HTMLFormElement);
    fireEvent.change(selects[2], { target: { value: "11" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "44.5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Push reading" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(loadSensorSummaryForGarden).toHaveBeenCalledWith(garden, true);
      expect(registerSensor).toHaveBeenCalledWith({
        bed_id: 1,
        name: "Probe 2",
        sensor_kind: "soil_moisture",
        unit: "%",
        location_label: "Bed B",
        hardware_id: "HW-2",
      });
      expect(ingestSensorData).toHaveBeenCalledWith(11, 44.5);
    });

    expect(screen.getByText("Water Bed A")).toBeInTheDocument();
    expect(screen.getByText(/Latest: 41 %/i)).toBeInTheDocument();
  });

  it("reports registration and ingestion failures via notices", async () => {
    const pushNotice = vi.fn();
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);

    render(
      <SensorsPageSection
        selectedGardenName="Backyard"
        selectedGardenRecord={undefined}
        beds={[{ id: 1, garden_id: 1, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }]}
        summary={summary}
        isLoading={true}
        loadSensorSummaryForGarden={loadSensorSummaryForGarden}
        gardenActions={{
          registerSensor: vi.fn(async () => { throw new Error("Register failed"); }),
          ingestSensorData: vi.fn(async () => { throw new Error("Ingest failed"); }),
        }}
        pushNotice={pushNotice}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.change(screen.getByPlaceholderText("Bed A Moisture Probe"), { target: { value: "Probe 2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Register sensor" }).closest("form") as HTMLFormElement);
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "11" } });
    fireEvent.submit(screen.getByRole("button", { name: "Push reading" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(pushNotice).toHaveBeenCalledWith("Register failed", "error");
      expect(pushNotice).toHaveBeenCalledWith("Ingest failed", "error");
    });

    expect(loadSensorSummaryForGarden).not.toHaveBeenCalled();
    expect(screen.getByText(/Loading sensor telemetry/i)).toBeInTheDocument();
  });
});