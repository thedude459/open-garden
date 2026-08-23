import { localToPlan, type RotatableBed } from './rotate';

/** Inverse of localToPlan. Local inches of a plan-space point relative to a sized bed. */
export function planToLocal(
  bed: RotatableBed,
  planX: number,
  planY: number,
): { x: number; y: number } {
  const { originXInches: ox, originYInches: oy, lengthInches: L, widthInches: W, orientation } =
    bed;
  let x: number;
  let y: number;
  switch (orientation) {
    case 0:
      x = planX - ox;
      y = planY - oy;
      break;
    case 90:
      x = oy + L - planY;
      y = planX - ox;
      break;
    case 180:
      x = ox + L - planX;
      y = oy + W - planY;
      break;
    case 270:
      x = planY - oy;
      y = ox + W - planX;
      break;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

export function roundTripLocal(bed: RotatableBed, localX: number, localY: number): { x: number; y: number } {
  const plan = localToPlan(bed, localX, localY);
  return planToLocal(bed, plan.x, plan.y);
}

/** Map a client (screen) point into plan inches given pan/scale of the viewport. */
export function clientToPlanWithPanScale(
  clientX: number,
  clientY: number,
  viewportLeft: number,
  viewportTop: number,
  panX: number,
  panY: number,
  scale: number,
  pxPerInch: number,
): { x: number; y: number } {
  const inchesPerPx = 1 / (pxPerInch * scale);
  return {
    x: Math.round((-panX + (clientX - viewportLeft)) * inchesPerPx),
    y: Math.round((-panY + (clientY - viewportTop)) * inchesPerPx),
  };
}
