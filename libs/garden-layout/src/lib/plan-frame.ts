export type PlanFrame = { x: number; y: number; w: number; h: number };
export type PlanRect = { x0: number; y0: number; x1: number; y1: number };

const PAD = 36;
export const HALF_FOOT_INCHES = 6;

/** Nearest half foot, in inches. */
export function snapHalfFoot(inches: number): number {
  return Math.round(inches / HALF_FOOT_INCHES) * HALF_FOOT_INCHES;
}

function snapDown(inches: number): number {
  return Math.floor(inches / HALF_FOOT_INCHES) * HALF_FOOT_INCHES;
}

function snapUp(inches: number): number {
  return Math.ceil(inches / HALF_FOOT_INCHES) * HALF_FOOT_INCHES;
}

/** Camera around the plot. Empty plot uses the same default as the plan canvas. */
export function frameAround(rects: PlanRect[]): PlanFrame {
  if (!rects.length) return { x: 0, y: 0, w: 240, h: 160 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x0);
    minY = Math.min(minY, rect.y0);
    maxX = Math.max(maxX, rect.x1);
    maxY = Math.max(maxY, rect.y1);
  }
  return {
    x: minX - PAD,
    y: minY - PAD,
    w: Math.max(Math.ceil(maxX - minX + PAD * 2), 160),
    h: Math.max(Math.ceil(maxY - minY + PAD * 2), 120),
  };
}

/** True when every rectangle sits inside the plot. Empty content fits. */
export function rectsFit(frame: PlanFrame, rects: PlanRect[]): boolean {
  const right = frame.x + frame.w;
  const bottom = frame.y + frame.h;
  return rects.every(
    (rect) => rect.x0 >= frame.x && rect.y0 >= frame.y && rect.x1 <= right && rect.y1 <= bottom,
  );
}

/** Half-foot size that stays inside the plot, measured from a fixed origin. */
export function clampSizeToPlot(
  frame: PlanFrame,
  originX: number,
  originY: number,
  width: number,
  height: number,
): { width: number; height: number } {
  const maxW = frame.x + frame.w - originX;
  const maxH = frame.y + frame.h - originY;
  let nextW = Math.max(HALF_FOOT_INCHES, snapHalfFoot(width));
  let nextH = Math.max(HALF_FOOT_INCHES, snapHalfFoot(height));
  if (nextW > maxW) nextW = Math.max(HALF_FOOT_INCHES, snapDown(maxW));
  if (nextH > maxH) nextH = Math.max(HALF_FOOT_INCHES, snapDown(maxH));
  return { width: nextW, height: nextH };
}

/** Half-foot origin that keeps the rectangle inside the plot. */
export function clampOriginToPlot(
  frame: PlanFrame,
  originX: number,
  originY: number,
  width: number,
  height: number,
): { originXInches: number; originYInches: number } {
  const right = frame.x + frame.w;
  const bottom = frame.y + frame.h;
  let x = snapHalfFoot(originX);
  let y = snapHalfFoot(originY);
  if (x < frame.x) x = snapUp(frame.x);
  if (y < frame.y) y = snapUp(frame.y);
  if (x + width > right) x = snapDown(right - width);
  if (y + height > bottom) y = snapDown(bottom - height);
  if (x < frame.x) x = frame.x;
  if (y < frame.y) y = frame.y;
  return { originXInches: x, originYInches: y };
}

/** Within one half-foot of the plot boundary. */
export function rectAtPlotEdge(
  frame: PlanFrame,
  originX: number,
  originY: number,
  width: number,
  height: number,
): boolean {
  const right = frame.x + frame.w;
  const bottom = frame.y + frame.h;
  return (
    originX - frame.x < HALF_FOOT_INCHES ||
    originY - frame.y < HALF_FOOT_INCHES ||
    right - (originX + width) < HALF_FOOT_INCHES ||
    bottom - (originY + height) < HALF_FOOT_INCHES
  );
}

export function formatPlanFrame(frame: PlanFrame): string {
  return `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;
}
