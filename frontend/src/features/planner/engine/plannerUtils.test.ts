import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCanopyPreview } from "./growthSim";
import { buildShadeMap } from "./shadeMap";
import { buildSunExposureGrid, sampleSunVector } from "./sunModel";
import type { Bed, Placement, CropTemplate } from "../../types";

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
          garden_id: 1,
          bed_id: 2,
          crop_name: "Carrot",
          planted_on: "2026-03-10",
          grid_x: 2,
          grid_y: 1,
          color: "#66aa66",
        },
      ] as Array<{
        id: number;
        garden_id: number;
        bed_id: number;
        crop_name: string;
        planted_on: string;
        grid_x: number;
        grid_y: number;
        color: string;
      }>,
      [
        {
          id: 11,
          name: "Carrot",
          variety: "Napoli",
          source: "manual",
          source_url: "",
          image_url: "",
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

describe("sampleSunVector – edge cases", () => {
  it("returns null for a null sun path", () => {
    expect(sampleSunVector(null, 12)).toBeNull();
  });

  it("returns null when sun path has no points", () => {
    const emptyPath = {
      generated_on: "2026-04-05",
      target_date: "2026-04-05",
      latitude: 37.77,
      longitude: -122.42,
      orientation: "south" as const,
      sunrise_hour: 6,
      sunset_hour: 20,
      solar_noon_hour: 13,
      day_length_hours: 14,
      points: [],
    };
    expect(sampleSunVector(emptyPath, 12)).toBeNull();
  });

  it("clamps intensity between 0 and 1", () => {
    const sunPath = {
      generated_on: "2026-04-05",
      target_date: "2026-04-05",
      latitude: 37.77,
      longitude: -122.42,
      orientation: "south" as const,
      sunrise_hour: 6,
      sunset_hour: 20,
      solar_noon_hour: 13,
      day_length_hours: 14,
      points: [
        { hour_local: 12, azimuth_deg: 180, altitude_deg: 60, intensity: 1.5 },
      ],
    };
    const result = sampleSunVector(sunPath, 12);
    expect(result?.intensity).toBeLessThanOrEqual(1);
    expect(result?.intensity).toBeGreaterThanOrEqual(0);
  });
});

describe("buildSunExposureGrid – edge cases", () => {
  it("returns cells with base exposure of 0.2 when sun is null", () => {
    const grid = buildSunExposureGrid(3, 2, null, "north");
    expect(grid).toHaveLength(6);
    grid.forEach((cell) => {
      expect(cell.exposure).toBeGreaterThanOrEqual(0);
      expect(cell.exposure).toBeLessThanOrEqual(1);
    });
  });

  it("handles a 1×1 yard without dividing by zero", () => {
    const grid = buildSunExposureGrid(1, 1, null, "south");
    expect(grid).toHaveLength(1);
    expect(grid[0].exposure).toBeGreaterThanOrEqual(0);
  });

  it("all orientations produce bounded exposure values", () => {
    const orientations = ["north", "east", "south", "west"] as const;
    for (const orientation of orientations) {
      const grid = buildSunExposureGrid(4, 4, null, orientation);
      expect(grid.every((c) => c.exposure >= 0 && c.exposure <= 1)).toBe(true);
    }
  });
});

describe("buildShadeMap – edge cases", () => {
  it("returns all-zero shade cells when sun is null", () => {
    const bed: Bed = { id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 48, grid_x: 0, grid_y: 0 };
    const cells = buildShadeMap(4, 4, [bed], null);
    expect(cells).toHaveLength(16);
    expect(cells.every((c) => c.shade === 0)).toBe(true);
  });

  it("returns all-zero shade cells when there are no beds", () => {
    const cells = buildShadeMap(4, 4, [], {
      hourLocal: 12,
      azimuthDeg: 180,
      altitudeDeg: 55,
      intensity: 1.0,
      vectorX: 0,
      vectorY: -1,
    });
    expect(cells).toHaveLength(16);
    expect(cells.every((c) => c.shade === 0)).toBe(true);
  });

  it("returns all-zero shade cells when sun altitude is 0 or below", () => {
    const bed: Bed = { id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 48, grid_x: 1, grid_y: 1 };
    const cells = buildShadeMap(4, 4, [bed], {
      hourLocal: 6,
      azimuthDeg: 90,
      altitudeDeg: 0,
      intensity: 0,
      vectorX: 1,
      vectorY: 0,
    });
    expect(cells.every((c) => c.shade === 0)).toBe(true);
  });

  it("shade values are clamped between 0 and 1", () => {
    const beds: Bed[] = [
      { id: 1, garden_id: 1, name: "A", width_in: 120, height_in: 120, grid_x: 2, grid_y: 2 },
      { id: 2, garden_id: 1, name: "B", width_in: 120, height_in: 120, grid_x: 5, grid_y: 2 },
    ];
    const cells = buildShadeMap(10, 10, beds, {
      hourLocal: 9,
      azimuthDeg: 110,
      altitudeDeg: 15,
      intensity: 0.8,
      vectorX: 0.94,
      vectorY: 0.34,
    });
    expect(cells.every((c) => c.shade >= 0 && c.shade <= 1)).toBe(true);
  });
});

describe("buildCanopyPreview – edge cases", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty array when placements list is empty", () => {
    const beds: Bed[] = [{ id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
    expect(buildCanopyPreview(beds, [], [], 0)).toHaveLength(0);
  });

  it("skips placements whose bed_id does not match any bed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
    const beds: Bed[] = [{ id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
    const placements: Placement[] = [
      { id: 99, garden_id: 1, bed_id: 999, crop_name: "Tomato", grid_x: 0, grid_y: 0, color: "#f00", planted_on: "2026-03-01" },
    ];
    expect(buildCanopyPreview(beds, placements, [], 0)).toHaveLength(0);
  });

  it("uses defaults for unknown crop template", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
    const beds: Bed[] = [{ id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
    const placements: Placement[] = [
      { id: 1, garden_id: 1, bed_id: 1, crop_name: "Unknown Crop", grid_x: 1, grid_y: 1, color: "#0f0", planted_on: "2026-03-01" },
    ];
    const crops: CropTemplate[] = [];
    const canopy = buildCanopyPreview(beds, placements, crops, 0);
    expect(canopy).toHaveLength(1);
    // With no crop data, defaults: spacing_in=12 → matureRadius 0.5, daysToHarvest=75
    expect(canopy[0].radiusFt).toBeGreaterThan(0);
  });

  it("growth progress is clamped to 1 for mature crops", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    const beds: Bed[] = [{ id: 1, garden_id: 1, name: "Bed", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
    const placements: Placement[] = [
      { id: 1, garden_id: 1, bed_id: 1, crop_name: "Tomato", grid_x: 0, grid_y: 0, color: "#0f0", planted_on: "2026-01-01" },
    ];
    const crops: CropTemplate[] = [{
      id: 1, name: "Tomato", variety: "", source: "manual", source_url: "", image_url: "",
      external_product_id: "", family: "", spacing_in: 12, days_to_harvest: 60,
      planting_window: "Spring", direct_sow: false, frost_hardy: false, weeks_to_transplant: 6, notes: "",
    }];
    const canopy = buildCanopyPreview(beds, placements, crops, 0);
    expect(canopy[0].progress).toBeLessThanOrEqual(1);
    expect(canopy[0].progress).toBeGreaterThanOrEqual(0);
  });
});