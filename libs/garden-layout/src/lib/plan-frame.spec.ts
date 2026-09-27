import { describe, expect, it } from 'vitest';
import { expandFrameToFit, frameAround } from './plan-frame';

describe('plan frame', () => {
  it('pads the plot and leaves a move inside that pad on the same camera', () => {
    const frame = frameAround([{ x0: 0, y0: 0, x1: 96, y1: 48 }]);
    expect(frame).toEqual({ x: -36, y: -36, w: 168, h: 120 });
    const moved = expandFrameToFit(frame, [{ x0: 12, y0: 0, x1: 108, y1: 48 }]);
    expect(moved).toBe(frame);
  });

  it('grows only the side a bed crosses', () => {
    const frame = { x: 0, y: 0, w: 100, h: 80 };
    expect(expandFrameToFit(frame, [{ x0: -8, y0: 10, x1: 40, y1: 30 }])).toEqual({
      x: -8,
      y: 0,
      w: 108,
      h: 80,
    });
  });
});
