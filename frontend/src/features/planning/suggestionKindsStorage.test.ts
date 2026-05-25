import { beforeEach, describe, expect, it } from "vitest";

import {
  ALL_PLANT_KINDS,
  readStoredSuggestionKinds,
  suggestionKindsSearchSuffix,
  suggestionKindsSignature,
  writeStoredSuggestionKinds,
} from "./suggestionKindsStorage";

describe("suggestionKindsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses full signature when every kind is selected", () => {
    expect(suggestionKindsSignature([...ALL_PLANT_KINDS])).toBe("full");
    expect(suggestionKindsSearchSuffix([...ALL_PLANT_KINDS])).toBe("");
  });

  it("builds a stable signature and query for subset selections", () => {
    expect(suggestionKindsSignature(["herb", "vegetable"])).toBe("herb|vegetable");
    expect(suggestionKindsSearchSuffix(["herb", "vegetable"])).toBe(
      "?suggestion_kinds=" + encodeURIComponent("herb,vegetable"),
    );
  });

  it("reads and writes per-garden kind selections", () => {
    writeStoredSuggestionKinds(7, ["herb", "flower"]);
    expect(readStoredSuggestionKinds(7)).toEqual(["flower", "herb"]);
    expect(readStoredSuggestionKinds(99)).toEqual([...ALL_PLANT_KINDS]);
  });

  it("falls back to all kinds for invalid stored JSON", () => {
    localStorage.setItem("seasonalSuggestionKinds:3", "not-json");
    expect(readStoredSuggestionKinds(3)).toEqual([...ALL_PLANT_KINDS]);
  });
});
