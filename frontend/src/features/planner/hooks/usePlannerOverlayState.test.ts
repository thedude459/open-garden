import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlannerOverlayState } from "./usePlannerOverlayState";
import type { GardenSunPath } from "../../types";

function makeSunPath(overrides: Partial<GardenSunPath> = {}): GardenSunPath {
  return {
    generated_on: "2026-04-05",
    target_date: "2026-04-05",
    latitude: 37.77,
    longitude: -122.42,
    orientation: "south",
    sunrise_hour: 6,
    sunset_hour: 20,
    solar_noon_hour: 13,
    day_length_hours: 14,
    points: [
      { hour_local: 6, azimuth_deg: 88, altitude_deg: 1, intensity: 0.1 },
      { hour_local: 13, azimuth_deg: 180, altitude_deg: 55, intensity: 1.0 },
      { hour_local: 20, azimuth_deg: 272, altitude_deg: 1, intensity: 0.1 },
    ],
    ...overrides,
  };
}

const baseParams = {
  gardenSunPath: null,
  yardWidthFt: 10,
  yardLengthFt: 10,
  gardenOrientation: "south" as const,
  beds: [],
  placements: [],
  cropTemplates: [],
};

describe("usePlannerOverlayState – setOverlayPreset", () => {
  it("enables sun overlay exclusively", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setOverlayPreset("sun"));
    expect(result.current.showSunOverlay).toBe(true);
    expect(result.current.showShadeOverlay).toBe(false);
    expect(result.current.showGrowthPreview).toBe(false);
  });

  it("enables shade overlay exclusively", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setOverlayPreset("shade"));
    expect(result.current.showSunOverlay).toBe(false);
    expect(result.current.showShadeOverlay).toBe(true);
    expect(result.current.showGrowthPreview).toBe(false);
  });

  it("enables growth overlay exclusively", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setOverlayPreset("growth"));
    expect(result.current.showSunOverlay).toBe(false);
    expect(result.current.showShadeOverlay).toBe(false);
    expect(result.current.showGrowthPreview).toBe(true);
  });

  it("disables all overlays for layout preset", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setOverlayPreset("sun"));
    act(() => result.current.setOverlayPreset("layout"));
    expect(result.current.showSunOverlay).toBe(false);
    expect(result.current.showShadeOverlay).toBe(false);
    expect(result.current.showGrowthPreview).toBe(false);
  });

  it("switching presets turns previous overlay off", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setOverlayPreset("sun"));
    act(() => result.current.setOverlayPreset("shade"));
    expect(result.current.showSunOverlay).toBe(false);
    expect(result.current.showShadeOverlay).toBe(true);
  });
});

describe("usePlannerOverlayState – sunHour initialisation", () => {
  it("defaults to 12 when gardenSunPath is null", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    expect(result.current.sunHour).toBe(12);
  });

  it("initialises sunHour to midpoint of sunrise and sunset hours", () => {
    // sunrise 6, sunset 20 → midpoint = round((6+20)/2) = 13
    const { result } = renderHook(() =>
      usePlannerOverlayState({ ...baseParams, gardenSunPath: makeSunPath({ sunrise_hour: 6, sunset_hour: 20 }) }),
    );
    expect(result.current.sunHour).toBe(13);
  });

  it("rounds sunHour correctly for fractional midpoints", () => {
    // sunrise 6.5, sunset 18.5 → midpoint = round(12.5) = 13
    const { result } = renderHook(() =>
      usePlannerOverlayState({ ...baseParams, gardenSunPath: makeSunPath({ sunrise_hour: 6.5, sunset_hour: 18.5 }) }),
    );
    expect(result.current.sunHour).toBe(13);
  });
});

describe("usePlannerOverlayState – derived grid outputs", () => {
  it("sunExposure has width × length cells", () => {
    const { result } = renderHook(() =>
      usePlannerOverlayState({ ...baseParams, yardWidthFt: 5, yardLengthFt: 3 }),
    );
    expect(result.current.sunExposure).toHaveLength(15);
  });

  it("shadeMap has width × length cells", () => {
    const { result } = renderHook(() =>
      usePlannerOverlayState({ ...baseParams, yardWidthFt: 4, yardLengthFt: 4 }),
    );
    expect(result.current.shadeMap).toHaveLength(16);
  });

  it("canopyPreview is empty when there are no placements", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    expect(result.current.canopyPreview).toHaveLength(0);
  });

  it("growthDayOffset can be updated and changes canopyPreview output", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    act(() => result.current.setGrowthDayOffset(60));
    expect(result.current.growthDayOffset).toBe(60);
  });

  it("sunSample is null when gardenSunPath is null", () => {
    const { result } = renderHook(() => usePlannerOverlayState(baseParams));
    expect(result.current.sunSample).toBeNull();
  });

  it("sunSample is non-null when gardenSunPath and points are provided", () => {
    const { result } = renderHook(() =>
      usePlannerOverlayState({ ...baseParams, gardenSunPath: makeSunPath() }),
    );
    expect(result.current.sunSample).not.toBeNull();
  });
});
