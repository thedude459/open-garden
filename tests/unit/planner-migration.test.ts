import { describe, expect, it } from "vitest";
import {
  needsVisualUpgrade,
  projectGardenForVisualPlanner,
  thumbnailUrlFromKey,
} from "@/lib/planner/migration";

describe("planner migration", () => {
  it("flags visual_version 0 gardens for upgrade projection", () => {
    expect(needsVisualUpgrade(0)).toBe(true);
    expect(needsVisualUpgrade(1)).toBe(false);
  });

  it("builds thumbnail URL from storage key", () => {
    expect(thumbnailUrlFromKey("garden-1", "planner/thumbnails/garden-1.webp")).toBe(
      "/planner/thumbnails/garden-1.webp",
    );
    expect(thumbnailUrlFromKey("garden-1", null)).toBeNull();
  });

  it("projects illustration metadata onto placements", () => {
    const visual = projectGardenForVisualPlanner(
      {
        id: "g1",
        name: "Test",
        length: 10,
        width: 10,
        unit: "feet",
        description: null,
        version: 1,
        areas: [],
        placements: [
          {
            id: "p1",
            bed_area_id: "b1",
            plant: { id: "plant-1", common_name: "Tomato", provenance: "authoritative" },
            position_x: 1,
            position_y: 2,
            status: "direct_seeded",
            planted_on: "2026-07-05",
            spacing_radius: 1,
          },
        ],
        indoor_starts: [],
      },
      {
        zone_type: "vegetable_garden",
        visual_version: 0,
        thumbnail_url: null,
        structures: [],
        placementIllustrations: new Map([["p1", "/planner/plants/tomato.svg"]]),
        placementMeta: new Map([
          ["p1", { rootstock_id: null, z_index: 2, locked: false }],
        ]),
      },
    );

    expect(visual.placements[0]?.illustration_url).toBe("/planner/plants/tomato.svg");
    expect(visual.placements[0]?.z_index).toBe(2);
    expect(visual.zone_type).toBe("vegetable_garden");
  });
});
