import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Garden } from "../../types";
import { useGardenSensorActions } from "./useGardenSensorActions";

const garden: Garden = {
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
};

describe("useGardenSensorActions", () => {
  it("returns early when no garden is selected", async () => {
    const fetchAuthed = vi.fn();
    const invalidateSensorCaches = vi.fn();
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useGardenSensorActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        selectedGardenRecord: undefined,
        invalidateSensorCaches,
        loadSensorSummaryForGarden,
      }),
    );

    await act(async () => {
      await result.current.registerSensor({
        bed_id: null,
        name: "Soil probe",
        sensor_kind: "soil_moisture",
        unit: "%",
        location_label: "North bed",
        hardware_id: "abc-123",
      });
      await result.current.ingestSensorData(9, 42);
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
    expect(invalidateSensorCaches).not.toHaveBeenCalled();
    expect(loadSensorSummaryForGarden).not.toHaveBeenCalled();
    expect(pushNotice).not.toHaveBeenCalled();
  });

  it("registers a sensor and refreshes cached sensor summary", async () => {
    const fetchAuthed = vi.fn(async () => ({ id: 3 }));
    const invalidateSensorCaches = vi.fn();
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useGardenSensorActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        selectedGardenRecord: garden,
        invalidateSensorCaches,
        loadSensorSummaryForGarden,
      }),
    );

    await act(async () => {
      await result.current.registerSensor({
        bed_id: null,
        name: "Soil probe",
        sensor_kind: "soil_moisture",
        unit: "%",
        location_label: "North bed",
        hardware_id: "abc-123",
      });
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/sensors/register",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSensorCaches).toHaveBeenCalledWith(1);
    expect(loadSensorSummaryForGarden).toHaveBeenCalledWith(garden, true);
    expect(pushNotice).toHaveBeenCalledWith("Sensor registered.", "success");
  });

  it("ingests a reading and refreshes cached sensor summary", async () => {
    const fetchAuthed = vi.fn(async () => ({ ok: true }));
    const invalidateSensorCaches = vi.fn();
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useGardenSensorActions({
        fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
        pushNotice,
        selectedGardenRecord: garden,
        invalidateSensorCaches,
        loadSensorSummaryForGarden,
      }),
    );

    await act(async () => {
      await result.current.ingestSensorData(9, 42);
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/sensors/9/data",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSensorCaches).toHaveBeenCalledWith(1);
    expect(loadSensorSummaryForGarden).toHaveBeenCalledWith(garden, true);
    expect(pushNotice).toHaveBeenCalledWith("Sensor reading ingested.", "success");
  });
});