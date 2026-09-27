export type PlanFrame = { x: number; y: number; w: number; h: number };
export type PlanRect = { x0: number; y0: number; x1: number; y1: number };

const PAD = 36;

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

/**
 * Grow the camera only when content leaves it.
 * ponytail: a move that exits the padded frame expands the frame on the next
 * read and can zoom the map out. Upgrade path: keep scale and pan to compensate.
 */
export function expandFrameToFit(frame: PlanFrame, rects: PlanRect[]): PlanFrame {
  if (!rects.length) return frame;
  let minX = frame.x;
  let minY = frame.y;
  let maxX = frame.x + frame.w;
  let maxY = frame.y + frame.h;
  let grew = false;
  for (const rect of rects) {
    if (rect.x0 < minX) {
      minX = rect.x0;
      grew = true;
    }
    if (rect.y0 < minY) {
      minY = rect.y0;
      grew = true;
    }
    if (rect.x1 > maxX) {
      maxX = rect.x1;
      grew = true;
    }
    if (rect.y1 > maxY) {
      maxY = rect.y1;
      grew = true;
    }
  }
  if (!grew) return frame;
  return { x: minX, y: minY, w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
}

export function formatPlanFrame(frame: PlanFrame): string {
  return `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;
}
