import { describe, expect, it } from "vitest";

import { CropTemplate } from "../../types";
import { colorForCrop, cropBaseName, cropDisplayName } from "./cropUtils";

function makeCropTemplate(overrides: Partial<CropTemplate>): CropTemplate {
  return {
    id: 1,
    name: "Tomato",
    variety: "",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "nightshade",
    spacing_in: 12,
    row_spacing_in: 18,
    in_row_spacing_in: 12,
    days_to_harvest: 75,
    planting_window: "Spring",
    direct_sow: false,
    frost_hardy: false,
    weeks_to_transplant: 6,
    notes: "",
    ...overrides,
  };
}

describe("cropUtils", () => {
  it("strips parenthetical variety suffix from base name", () => {
    expect(cropBaseName(makeCropTemplate({ name: "Tomato (Roma)", variety: "Roma" }))).toBe("Tomato");
  });

  it("keeps crop name unchanged when suffix format does not match", () => {
    expect(cropBaseName(makeCropTemplate({ name: "Tomato Roma", variety: "Roma" }))).toBe("Tomato Roma");
  });

  it("builds display name with bullet when variety exists", () => {
    expect(cropDisplayName(makeCropTemplate({ name: "Tomato (Roma)", variety: "Roma" }))).toBe("Tomato • Roma");
  });

  it("returns deterministic crop colors and falls back for blank names", () => {
    expect(colorForCrop("Tomato")).toBe(colorForCrop("Tomato"));
    expect(colorForCrop("   ")).toMatch(/^#/);
  });
});
