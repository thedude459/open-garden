import { describe, expect, it } from "vitest";
import { applyLayerPatch, buildLayerItems, sendBackward, sendForward, sortByZIndex } from "@/lib/planner/layers";

describe("planner layers", () => {
  it("sorts items by z_index ascending", () => {
    const sorted = sortByZIndex([
      { id: "b", z_index: 2 },
      { id: "a", z_index: 0 },
      { id: "c", z_index: 5 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("builds merged layer items from structures and placements", () => {
    const layers = buildLayerItems(
      [{ id: "s1", z_index: 1, locked: false }],
      [{ id: "p1", z_index: 0, locked: true }],
    );
    expect(layers).toHaveLength(2);
    expect(layers[0]?.kind).toBe("placement");
    expect(layers[1]?.kind).toBe("structure");
  });

  it("applies z_index and lock patches", () => {
    const initial = buildLayerItems([], [{ id: "p1", z_index: 0, locked: false }]);
    const patched = applyLayerPatch(initial, [
      { id: "p1", kind: "placement", z_index: 3, locked: true },
    ]);
    expect(patched[0]?.z_index).toBe(3);
    expect(patched[0]?.locked).toBe(true);
  });

  it("swaps z_index on send forward/backward", () => {
    const items = buildLayerItems(
      [
        { id: "s1", z_index: 0, locked: false },
        { id: "s2", z_index: 1, locked: false },
      ],
      [],
    );
    const forward = sendForward(items, "s1");
    expect(forward.find((item) => item.id === "s1")?.z_index).toBe(1);
    const backward = sendBackward(forward, "s2");
    expect(backward.find((item) => item.id === "s2")?.z_index).toBe(0);
  });
});

describe("planner migration", () => {
  it("projects illustration URLs onto placements", async () => {
    const { projectGardenForVisualPlanner } = await import("@/lib/planner/migration");
    const detail = {
      id: "g1",
      name: "Test",
      length: 20,
      width: 10,
      unit: "feet" as const,
      description: null,
      version: 1,
      areas: [],
      indoor_starts: [],
      placements: [
        {
          id: "p1",
          bed_area_id: "b1",
          plant: { id: "plant1", common_name: "Tomato", provenance: "authoritative" as const },
          position_x: 2,
          position_y: 2,
          status: "direct_seeded" as const,
          planted_on: "2026-06-01",
          spacing_radius: 1,
        },
      ],
    };

    const visual = projectGardenForVisualPlanner(detail, {
      zone_type: "vegetable_garden",
      visual_version: 0,
      thumbnail_url: null,
      structures: [],
      placementIllustrations: new Map([["p1", "/planner/categories/vegetable.svg"]]),
      placementMeta: new Map([["p1", { rootstock_id: null, z_index: 0, locked: false }]]),
    });

    expect(visual.placements[0]?.illustration_url).toBe("/planner/categories/vegetable.svg");
    expect(visual.zone_type).toBe("vegetable_garden");
  });
});
