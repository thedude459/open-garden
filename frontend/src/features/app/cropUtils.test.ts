import { describe, expect, it } from "vitest";

import { colorForCrop, cropBaseName, cropDisplayName } from "./cropUtils";

describe("cropUtils", () => {
  it("strips parenthetical variety suffix from base name", () => {
    expect(cropBaseName({ name: "Tomato (Roma)", variety: "Roma" } as any)).toBe("Tomato");
  });

  it("keeps crop name unchanged when suffix format does not match", () => {
    expect(cropBaseName({ name: "Tomato Roma", variety: "Roma" } as any)).toBe("Tomato Roma");
  });

  it("builds display name with bullet when variety exists", () => {
    expect(cropDisplayName({ name: "Tomato (Roma)", variety: "Roma" } as any)).toBe("Tomato • Roma");
  });

  it("returns deterministic crop colors and falls back for blank names", () => {
    expect(colorForCrop("Tomato")).toBe(colorForCrop("Tomato"));
    expect(colorForCrop("   ")).toMatch(/^#/);
  });
});
