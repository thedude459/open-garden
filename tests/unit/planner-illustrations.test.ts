import { describe, expect, it } from "vitest";
import {
  illustrationPathToUrl,
  mapPlantCategoryToIllustration,
  resolveCategoryDefault,
  resolvePlantIllustrationSync,
  resolveStructureIllustration,
} from "@/lib/planner/illustrations";

describe("planner illustrations", () => {
  it("maps plant categories to illustration categories", () => {
    expect(mapPlantCategoryToIllustration("fruit_tree")).toBe("tree");
    expect(mapPlantCategoryToIllustration("companion_flower")).toBe("flower");
    expect(mapPlantCategoryToIllustration("unknown")).toBe("default");
  });

  it("never returns empty URL for sync fallback resolver", () => {
    const result = resolvePlantIllustrationSync("authoritative", "vegetable");
    expect(result.url).toBe("/planner/categories/vegetable.svg");
    expect(result.url.length).toBeGreaterThan(0);
    expect(result.is_fallback).toBe(true);
  });

  it("uses default category for provisional plants", () => {
    const result = resolvePlantIllustrationSync("provisional", null);
    expect(result.url).toBe("/planner/categories/default.svg");
  });

  it("normalizes illustration paths to public URLs", () => {
    expect(illustrationPathToUrl("planner/structures/path.svg")).toBe(
      "/planner/structures/path.svg",
    );
    expect(resolveStructureIllustration("planner/structures/greenhouse.svg")).toBe(
      "/planner/structures/greenhouse.svg",
    );
    expect(resolveCategoryDefault("herb")).toBe("/planner/categories/herb.svg");
  });
});
