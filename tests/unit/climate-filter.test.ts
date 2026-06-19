import { describe, expect, it } from "vitest";
import { isClimateCompatible } from "@/lib/catalog/climate-filter";

const INCOMPATIBLE_FOR_ZONE_8 = Array.from({ length: 20 }, (_, index) => ({
  hardinessMinZone: 9 + (index % 2),
  hardinessMaxZone: 11,
  seedStartWindow: null,
}));

const COMPATIBLE_FOR_ZONE_8 = {
  hardinessMinZone: 5,
  hardinessMaxZone: 10,
  seedStartWindow: null,
};

describe("climate filter reference set (SC-005)", () => {
  it("excludes at least 95% of incompatible reference plants for zone 8", () => {
    const location = { usda_zone: 8 };
    const referenceSet = [...INCOMPATIBLE_FOR_ZONE_8, COMPATIBLE_FOR_ZONE_8];
    const excluded = referenceSet.filter((plant) => !isClimateCompatible(plant, location));
    expect(excluded.length / referenceSet.length).toBeGreaterThanOrEqual(0.95);
  });
});
