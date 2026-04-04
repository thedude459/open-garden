import { Bed } from "../types";
import { SunVectorSample } from "./sunModel";

export type ShadeCell = {
  x: number;
  y: number;
  shade: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function bedCenterFt(bed: Bed): { x: number; y: number; widthFt: number; lengthFt: number } {
  const widthFt = Math.max(1, Math.ceil(bed.width_in / 12));
  const lengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
  return {
    x: bed.grid_x + widthFt / 2,
    y: bed.grid_y + lengthFt / 2,
    widthFt,
    lengthFt,
  };
}

export function buildShadeMap(yardWidthFt: number, yardLengthFt: number, beds: Bed[], sun: SunVectorSample | null): ShadeCell[] {
  const width = Math.max(1, Math.floor(yardWidthFt));
  const length = Math.max(1, Math.floor(yardLengthFt));
  const cells: ShadeCell[] = [];

  if (!sun || sun.altitudeDeg <= 0 || beds.length === 0) {
    for (let y = 0; y < length; y += 1) {
      for (let x = 0; x < width; x += 1) {
        cells.push({ x, y, shade: 0 });
      }
    }
    return cells;
  }

  const altitudeRad = (sun.altitudeDeg * Math.PI) / 180;
  const shadowLen = Math.max(0.8, 3 / Math.tan(Math.max(0.2, altitudeRad)));
  const castX = -sun.vectorX;
  const castY = -sun.vectorY;
  const occluders = beds.map((bed) => bedCenterFt(bed));

  for (let y = 0; y < length; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let shade = 0;

      for (const source of occluders) {
        const dx = cx - source.x;
        const dy = cy - source.y;
        const along = dx * castX + dy * castY;
        if (along <= 0 || along > shadowLen) {
          continue;
        }

        const px = dx - along * castX;
        const py = dy - along * castY;
        const lateral = Math.hypot(px, py);
        const spread = Math.max(0.7, Math.min(2.4, (source.widthFt + source.lengthFt) / 3.4));

        if (lateral <= spread) {
          shade += (1 - along / shadowLen) * (1 - lateral / spread) * 0.72;
        }
      }

      cells.push({ x, y, shade: clamp01(shade) });
    }
  }

  return cells;
}
