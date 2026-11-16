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

/** How the plan is zoomed and moved on screen: screen = pan + scale × drawn position. */
export type PlanView = { scale: number; panX: number; panY: number };

export const MIN_PLAN_SCALE = 0.5;
export const MAX_PLAN_SCALE = 16;

/** Where the whole plot is drawn before any zoom: fitted and centred (SVG "meet"). */
function baseFit(viewport: { width: number; height: number }, plot: PlanFrame) {
  const k = Math.min(viewport.width / plot.w, viewport.height / plot.h);
  return {
    k,
    ox: (viewport.width - plot.w * k) / 2,
    oy: (viewport.height - plot.h * k) / 2,
  };
}

/**
 * The zoom and pan that show `area` (in plan inches) centred and as large as
 * fits, within the scale limits. With no room to draw in, the plan is shown
 * as is.
 */
export function fitView(
  viewport: { width: number; height: number },
  plot: PlanFrame,
  area: PlanFrame,
): PlanView {
  if (viewport.width <= 0 || viewport.height <= 0 || area.w <= 0 || area.h <= 0) {
    return { scale: 1, panX: 0, panY: 0 };
  }
  const { k, ox, oy } = baseFit(viewport, plot);
  const scale = Math.min(
    MAX_PLAN_SCALE,
    Math.max(
      MIN_PLAN_SCALE,
      Math.min(viewport.width / (area.w * k), viewport.height / (area.h * k)),
    ),
  );
  const cx = ox + (area.x + area.w / 2 - plot.x) * k;
  const cy = oy + (area.y + area.h / 2 - plot.y) * k;
  return { scale, panX: viewport.width / 2 - scale * cx, panY: viewport.height / 2 - scale * cy };
}

/** The part of the plan (in inches) a view shows: what to remember and restore. */
export function visibleArea(
  viewport: { width: number; height: number },
  plot: PlanFrame,
  view: PlanView,
): PlanFrame {
  const { k, ox, oy } = baseFit(viewport, plot);
  const toPlanX = (screenX: number) => (screenX - view.panX) / view.scale / k - ox / k + plot.x;
  const toPlanY = (screenY: number) => (screenY - view.panY) / view.scale / k - oy / k + plot.y;
  const x = toPlanX(0);
  const y = toPlanY(0);
  return { x, y, w: toPlanX(viewport.width) - x, h: toPlanY(viewport.height) - y };
}

/** Zooms by `factor` about a screen point, keeping that point still. */
export function zoomAbout(view: PlanView, factor: number, at: { x: number; y: number }): PlanView {
  const scale = Math.min(MAX_PLAN_SCALE, Math.max(MIN_PLAN_SCALE, view.scale * factor));
  const ratio = scale / view.scale;
  return {
    scale,
    panX: at.x - (at.x - view.panX) * ratio,
    panY: at.y - (at.y - view.panY) * ratio,
  };
}

/**
 * The frame for a small picture of a property: its own size from the corner,
 * widened to any bed drawn past it.
 */
export function planOutlineFrame(plan: {
  lengthInches: number;
  widthInches: number;
  beds: { x: number; y: number; w: number; h: number }[];
}): PlanFrame {
  const x0 = Math.min(0, ...plan.beds.map((b) => b.x));
  const y0 = Math.min(0, ...plan.beds.map((b) => b.y));
  const x1 = Math.max(plan.lengthInches, ...plan.beds.map((b) => b.x + b.w));
  const y1 = Math.max(plan.widthInches, ...plan.beds.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
