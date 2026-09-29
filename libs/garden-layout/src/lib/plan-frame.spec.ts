import { describe, expect, it } from 'vitest';
import {
  clampOriginToPlot,
  clampSizeToPlot,
  frameAround,
  rectAtPlotEdge,
  rectsFit,
  snapHalfFoot,
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
