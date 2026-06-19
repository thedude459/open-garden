import { describe, expect, it } from "vitest";
import { filterOrganicFertilizer } from "@/lib/ingestion/fertilizer-filter";

describe("filterOrganicFertilizer (FR-017)", () => {
  it("strips non-organic fertilizer recommendations", () => {
    const result = filterOrganicFertilizer("Apply 10-10-10 synthetic fertilizer weekly");
    expect(result.value).toBeNull();
    expect(result.dataGap).toBe(true);
  });

  it("retains organic-aligned guidance", () => {
    const result = filterOrganicFertilizer("Side-dress with compost at planting");
    expect(result.value).toContain("compost");
    expect(result.dataGap).toBe(false);
  });

  it("returns gap for empty input", () => {
    const result = filterOrganicFertilizer("");
    expect(result.value).toBeNull();
    expect(result.dataGap).toBe(true);
  });
});
