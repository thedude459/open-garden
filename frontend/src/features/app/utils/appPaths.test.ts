import { beforeEach, describe, expect, it } from "vitest";

import {
  INTENDED_GARDEN_PAGE_KEY,
  buildAppPath,
  consumeIntendedGardenPage,
  gardenRequiredToolLabel,
  parseAppPath,
  peekIntendedGardenPage,
} from "./appPaths";

describe("appPaths", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("parses home, crops, and garden-scoped routes", () => {
    expect(parseAppPath("/")).toEqual({ kind: "home", page: "home", gardenId: null });
    expect(parseAppPath("/home")).toEqual({ kind: "home", page: "home", gardenId: null });
    expect(parseAppPath("/crops")).toEqual({ kind: "crops", page: "crops", gardenId: null });
    expect(parseAppPath("/g/3/journal")).toEqual({
      kind: "garden",
      page: "journal",
      gardenId: 3,
      slug: "journal",
    });
    expect(parseAppPath("/g/2/planner")).toMatchObject({ page: "planner", gardenId: 2 });
    expect(parseAppPath("/g/1/unknown")).toBeNull();
    expect(parseAppPath("/g/not-a-number/planner")).toBeNull();
  });

  it("builds stable paths for home, crops, and garden tools", () => {
    expect(buildAppPath("home", null)).toBe("/home");
    expect(buildAppPath("crops", null)).toBe("/crops");
    expect(buildAppPath("calendar", 4)).toBe("/g/4/calendar");
    expect(buildAppPath("journal", 9)).toBe("/g/9/journal");
    expect(buildAppPath("calendar", null)).toBe("/home");
  });

  it("stores and consumes intended garden page in session storage", () => {
    sessionStorage.setItem(INTENDED_GARDEN_PAGE_KEY, "journal");
    expect(peekIntendedGardenPage()).toBe("journal");
    expect(consumeIntendedGardenPage()).toBe("journal");
    expect(peekIntendedGardenPage()).toBeNull();
    expect(sessionStorage.getItem(INTENDED_GARDEN_PAGE_KEY)).toBeNull();
  });

  it("ignores invalid intended page values", () => {
    sessionStorage.setItem(INTENDED_GARDEN_PAGE_KEY, "not-a-page");
    expect(peekIntendedGardenPage()).toBeNull();
  });

  it("labels garden-required tools for UI copy", () => {
    expect(gardenRequiredToolLabel("journal")).toBe("Observation Journal");
    expect(gardenRequiredToolLabel("planner")).toBe("Bed Planner");
    expect(gardenRequiredToolLabel("home")).toBe("This tool");
  });
});
