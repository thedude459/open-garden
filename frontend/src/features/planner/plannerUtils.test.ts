import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCanopyPreview } from "./growthSim";
import { buildShadeMap } from "./shadeMap";
import { buildSunExposureGrid, sampleSunVector } from "./sunModel";

describe("planner helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("interpolates sun vectors and builds a bounded exposure grid", () => {
    const sun = sampleSunVector(
      {
        generated_on: "2026-03-18",
        target_date: "2026-03-18",
        latitude: 37.77,
        longitude: -122.42,
        orientation: "south",
        sunrise_hour: 6.5,
        sunset_hour: 18.5,
        solar_noon_hour: 12,
        day_length_hours: 12,
        points: [
          { hour_local: 9, azimuth_deg: 110, altitude_deg: 28, intensity: 0.45 },
          { hour_local: 15, azimuth_deg: 230, altitude_deg: 52, intensity: 0.9 },
        ],
      },
      12,
    );

    expect(sun).not.toBeNull();
    expect(sun?.azimuthDeg).toBeCloseTo(170, 5);
    expect(sun?.altitudeDeg).toBeCloseTo(40, 5);

    const grid = buildSunExposureGrid(3, 2, sun, "south");

    expect(grid).toHaveLength(6);
    expect(grid.every((cell) => cell.exposure >= 0 && cell.exposure <= 1)).toBe(true);
    expect(grid[0].exposure).not.toBe(grid[grid.length - 1].exposure);
  });

  it("casts shade when a sun sample and beds are present", () => {
    const shadeMap = buildShadeMap(
      4,
      4,
      [
        {
          id: 1,
          garden_id: 1,
          name: "North bed",
          width_in: 48,
          height_in: 48,
          grid_x: 1,
          grid_y: 1,
        },
      ],
      {
        hourLocal: 9,
        azimuthDeg: 110,
        altitudeDeg: 25,
        intensity: 0.7,
        vectorX: 0.94,
        vectorY: 0.34,
      },
    );

    expect(shadeMap).toHaveLength(16);
    expect(Math.max(...shadeMap.map((cell) => cell.shade))).toBeGreaterThan(0);
  });

  it("builds canopy previews using 3-inch grid placement coordinates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));

    const canopy = buildCanopyPreview(
      [
        {
          id: 2,
          garden_id: 1,
          name: "South bed",
          width_in: 48,
          height_in: 96,
          grid_x: 2,
          grid_y: 3,
        },
      ],
      [
        {
          id: 9,
          bed_id: 2,
          crop_name: "Carrot",
          planted_on: "2026-03-10",
          grid_x: 2,
          grid_y: 1,
        },
      ] as Array<{
        id: number;
        bed_id: number;
        crop_name: string;
        planted_on: string;
        grid_x: number;
        grid_y: number;
      }>,
      [
        {
          id: 11,
          name: "Carrot",
          variety: "Napoli",
          source: "manual",
          source_url: "",
          external_product_id: "",
          family: "Apiaceae",
          spacing_in: 6,
          days_to_harvest: 60,
          planting_window: "Spring",
          direct_sow: true,
          frost_hardy: true,
          weeks_to_transplant: 0,
          notes: "",
        },
      ],
      7,
    );

    expect(canopy).toHaveLength(1);
    expect(canopy[0].centerXFt).toBeCloseTo(2.625, 3);
    expect(canopy[0].centerYFt).toBeCloseTo(3.375, 3);
    expect(canopy[0].ageDays).toBe(15);
    expect(canopy[0].progress).toBeCloseTo(0.25, 2);
    expect(canopy[0].radiusFt).toBeCloseTo(0.115, 3);
  });
});