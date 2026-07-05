import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GardenDetail } from "@/lib/garden/types";

vi.mock("@/lib/catalog/query", () => ({
  getPlantById: vi.fn(),
  getRootstocks: vi.fn(),
}));

vi.mock("@/lib/garden/plant-context", () => ({
  resolvePlantSpacing: vi.fn(),
  resolveIncompatiblePlantIds: vi.fn(async () => new Set()),
}));

import { getPlantById } from "@/lib/catalog/query";
import { resolvePlantSpacing } from "@/lib/garden/plant-context";
import { validatePlacement } from "@/lib/garden/validation";

const mockedGetPlantById = vi.mocked(getPlantById);
const mockedResolvePlantSpacing = vi.mocked(resolvePlantSpacing);

function baseGarden(overrides: Partial<GardenDetail> = {}): GardenDetail {
  return {
    id: "g1",
    name: "Orchard",
    length: 40,
    width: 30,
    unit: "feet",
    description: null,
    version: 1,
    zone_type: "orchard",
    areas: [
      {
        id: "bed-1",
        area_type: "bed",
        name: "Main",
        origin_x: 0,
        origin_y: 0,
        length: 40,
        width: 30,
        rotation_degrees: 0,
        soil_type: null,
        sun_exposure: null,
      },
    ],
    placements: [],
    indoor_starts: [],
    ...overrides,
  };
}

describe("orchard tree spacing validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hard-blocks orchard tree placement without rootstock when options exist", async () => {
    mockedResolvePlantSpacing.mockResolvedValue({
      plant_id: "apple",
      provenance: "authoritative",
      common_name: "Apple",
      spacing_cm: 400,
      spacing_radius: 6.5,
    });
    mockedGetPlantById.mockResolvedValue({
      id: "apple",
      common_name: "Apple",
      plant_category: "fruit_tree",
      rootstocks: [
        {
          id: "rs-1",
          name: "M.9",
          vigor: "dwarf",
          mature_height_cm: 250,
          mature_spread_cm: 200,
          spacing_cm: 300,
        },
      ],
    } as Awaited<ReturnType<typeof getPlantById>>);

    const result = await validatePlacement(
      baseGarden(),
      {
        bed_area_id: "bed-1",
        plant_id: "apple",
        plant_provenance: "authoritative",
        position_x: 5,
        position_y: 5,
      },
      "user-1",
    );

    expect(result.valid).toBe(false);
    expect(result.violations.some((violation) => violation.code === "TREE_SPACING")).toBe(true);
  });

  it("allows orchard tree placement when rootstock spacing is satisfied", async () => {
    mockedResolvePlantSpacing.mockResolvedValue({
      plant_id: "apple",
      provenance: "authoritative",
      common_name: "Apple",
      spacing_cm: 400,
      spacing_radius: 6.5,
    });
    mockedGetPlantById.mockImplementation(async (plantId) => {
      if (plantId === "apple") {
        return {
          id: "apple",
          common_name: "Apple",
          plant_category: "fruit_tree",
          rootstocks: [
            {
              id: "rs-1",
              name: "M.9",
              vigor: "dwarf",
              mature_height_cm: 250,
              mature_spread_cm: 200,
              spacing_cm: 300,
            },
          ],
        } as Awaited<ReturnType<typeof getPlantById>>;
      }
      return null;
    });

    const result = await validatePlacement(
      baseGarden(),
      {
        bed_area_id: "bed-1",
        plant_id: "apple",
        plant_provenance: "authoritative",
        position_x: 20,
        position_y: 20,
        rootstock_id: "rs-1",
      },
      "user-1",
    );

    expect(result.valid).toBe(true);
  });
});
