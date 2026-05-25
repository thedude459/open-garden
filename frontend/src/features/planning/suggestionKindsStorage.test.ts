import { describe, expect, it } from "vitest";

import {
  ALL_PLANT_KINDS,
  suggestionKindsSearchSuffix,
  suggestionKindsSignature,
} from "./suggestionKindsStorage";

describe("suggestionKindsStorage", () => {
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
});
