import { describe, expect, it } from "vitest";
import {
  isOrchardTreeCategory,
  resolveCanopySpacingCm,
} from "@/lib/garden/orchard";
import { orchardAdvisoriesToWarnings } from "@/lib/garden/orchard-advisories";
import type { RootstockOption } from "@/lib/catalog/types";

describe("orchard canopy spacing", () => {
  const rootstocks: RootstockOption[] = [
    {
      id: "rs-1",
      name: "M.9",
      vigor: "dwarf",
      mature_height_cm: 250,
      mature_spread_cm: 200,
      spacing_cm: 300,
    },
  ];

  it("requires rootstock when options exist but none selected", () => {
    const result = resolveCanopySpacingCm(rootstocks, null, 400, 350);
    expect(result.requiresRootstock).toBe(true);
    expect(result.spacingCm).toBeNull();
  });

  it("uses rootstock spacing when selected", () => {
    const result = resolveCanopySpacingCm(rootstocks, "rs-1", 400, 350);
    expect(result.requiresRootstock).toBe(false);
    expect(result.spacingCm).toBe(300);
  });

  it("falls back to plant spacing when no rootstock options exist", () => {
    const result = resolveCanopySpacingCm([], null, 400, 350);
    expect(result.requiresRootstock).toBe(false);
    expect(result.spacingCm).toBe(400);
  });

  it("identifies orchard tree categories", () => {
    expect(isOrchardTreeCategory("fruit_tree")).toBe(true);
    expect(isOrchardTreeCategory("vegetable")).toBe(false);
  });
});

describe("orchard advisories", () => {
  it("maps advisories to validation warnings", () => {
    const warnings = orchardAdvisoriesToWarnings([
      {
        plant_id: "p1",
        common_name: "Basil",
        kind: "companion",
        rationale: "Companion for Apple.",
      },
      {
        plant_id: "p2",
        common_name: "Comfrey",
        kind: "understory",
        rationale: "Typical understory choice.",
      },
    ]);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]?.code).toBe("ORCHARD_COMPANION");
    expect(warnings[1]?.code).toBe("ORCHARD_GUILD");
  });
});
