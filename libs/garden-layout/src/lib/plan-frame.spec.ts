import { describe, expect, it } from 'vitest';
import {
  clampOriginToPlot,
  clampSizeToPlot,
  fitView,
  frameAround,
  MAX_PLAN_SCALE,
  MIN_PLAN_SCALE,
  rectAtPlotEdge,
  rectsFit,
  snapHalfFoot,
  visibleArea,
  zoomAbout,
} from './plan-frame';

describe('plan frame', () => {
  it('pads the plot and leaves a move inside that pad on the same camera', () => {
    const frame = frameAround([{ x0: 0, y0: 0, x1: 96, y1: 48 }]);
    expect(frame).toEqual({ x: -36, y: -36, w: 168, h: 120 });
    expect(rectsFit(frame, [{ x0: 12, y0: 0, x1: 108, y1: 48 }])).toBe(true);
  });

  it('snaps to half feet and stops a bed at the plot edge', () => {
    const frame = { x: 0, y: 0, w: 240, h: 160 };
    expect(snapHalfFoot(40)).toBe(42);
    expect(snapHalfFoot(97)).toBe(96);
    expect(clampSizeToPlot(frame, 0, 0, 300, 48)).toEqual({ width: 240, height: 48 });
    expect(clampOriginToPlot(frame, 200, 0, 96, 48)).toEqual({
      originXInches: 144,
      originYInches: 0,
    });
    expect(rectAtPlotEdge(frame, 144, 0, 96, 48)).toBe(true);
    expect(rectAtPlotEdge(frame, 36, 36, 96, 48)).toBe(false);
    expect(rectsFit(frame, [{ x0: 200, y0: 0, x1: 400, y1: 48 }])).toBe(false);
  });
});

describe('fitView and visibleArea', () => {
  const viewport = { width: 800, height: 400 };
  // A 100 × 50 ft property drawn into an 800 × 400 px view: 1 in = 8/12 px.
  const plot = { x: 0, y: 0, w: 1200, h: 600 };

  it('fills the view with a small bed in a large property, and shows that bed back', () => {
    const bed = { x: 120, y: 60, w: 96, h: 48 };
    const view = fitView(viewport, plot, bed);
    expect(view.scale).toBeCloseTo(12.5);
    const shown = visibleArea(viewport, plot, view);
    expect(shown.x).toBeCloseTo(120);
    expect(shown.y).toBeCloseTo(60);
    expect(shown.w).toBeCloseTo(96);
    expect(shown.h).toBeCloseTo(48);
  });

  it('a remembered area comes back the same in a different-sized window', () => {
    const area = { x: 300, y: 100, w: 400, h: 200 };
    const wide = visibleArea(viewport, plot, fitView(viewport, plot, area));
    const narrow = { width: 400, height: 200 };
    const again = visibleArea(narrow, plot, fitView(narrow, plot, wide));
    expect(again.x).toBeCloseTo(300);
    expect(again.w).toBeCloseTo(400);
  });

  it('keeps within the zoom limits, and leaves the plan alone with no room to draw', () => {
    expect(fitView(viewport, plot, { x: 0, y: 0, w: 2, h: 2 }).scale).toBe(MAX_PLAN_SCALE);
    expect(fitView(viewport, plot, { x: 0, y: 0, w: 99999, h: 99999 }).scale).toBe(MIN_PLAN_SCALE);
    expect(fitView({ width: 0, height: 0 }, plot, plot)).toEqual({ scale: 1, panX: 0, panY: 0 });
  });
});

describe('zoomAbout', () => {
  it('keeps the point under the cursor still', () => {
    const view = { scale: 2, panX: 10, panY: 20 };
    const at = { x: 400, y: 200 };
    const next = zoomAbout(view, 1.25, at);
    expect(next.scale).toBe(2.5);
    // The drawn point under `at` is the same before and after.
    expect((at.x - next.panX) / next.scale).toBeCloseTo((at.x - view.panX) / view.scale);
    expect((at.y - next.panY) / next.scale).toBeCloseTo((at.y - view.panY) / view.scale);
  });
});
