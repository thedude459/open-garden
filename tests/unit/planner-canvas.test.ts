import { describe, expect, it } from "vitest";
import {
  gardenPointFromSvg,
  layoutScale,
  svgDimensions,
  toSvgX,
  toSvgY,
} from "@/lib/planner/canvas-projection";

describe("planner canvas projection", () => {
  it("computes proportional scale for garden bounds", () => {
    const scale = layoutScale(20, 10);
    expect(scale).toBeGreaterThan(0);
    const { width, height } = svgDimensions(20, 10, scale);
    expect(width).toBeGreaterThan(height);
  });

  it("converts garden coordinates to SVG coordinates", () => {
    const scale = layoutScale(20, 10);
    expect(toSvgX(5, scale)).toBeGreaterThan(toSvgX(0, scale));
    expect(toSvgY(3, scale)).toBeGreaterThan(toSvgY(0, scale));
  });

  it("converts SVG coordinates back to garden space", () => {
    const scale = layoutScale(20, 10);
    const svgX = toSvgX(4, scale);
    const svgY = toSvgY(2, scale);
    const point = gardenPointFromSvg(svgX, svgY, scale);
    expect(point.x).toBeCloseTo(4, 5);
    expect(point.y).toBeCloseTo(2, 5);
  });
});
