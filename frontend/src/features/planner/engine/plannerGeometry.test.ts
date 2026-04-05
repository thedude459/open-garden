import { describe, expect, it } from "vitest";
import { getBedGridPositionForPoint } from "./plannerGeometry";
import { Bed } from "../../types";

const bed: Bed = {
  id: 10,
  garden_id: 1,
  name: "A",
  width_in: 48,
  height_in: 96,
  grid_x: 0,
  grid_y: 0,
};

describe("getBedGridPositionForPoint", () => {
  it("returns null when bed does not exist", () => {
    const rect = { left: 0, top: 0 } as DOMRect;
    const pos = getBedGridPositionForPoint({
      bedId: 999,
      clientX: 100,
      clientY: 100,
      beds: [bed],
      yardRect: rect,
      yardCellPx: 20,
      yardWidthFt: 20,
      yardLengthFt: 20,
    });

    expect(pos).toBeNull();
  });

  it("clamps bed position inside yard bounds", () => {
    const rect = { left: 0, top: 0 } as DOMRect;
    const pos = getBedGridPositionForPoint({
      bedId: 10,
      clientX: 10000,
      clientY: 10000,
      beds: [bed],
      yardRect: rect,
      yardCellPx: 20,
      yardWidthFt: 6,
      yardLengthFt: 10,
    });

    expect(pos).toEqual({ nextX: 2, nextY: 2 });
  });
});
