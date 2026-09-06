import { describe, expect, it } from 'vitest';
import { originFromCenter, originFromGrabOffset } from './origin';

describe('originFromCenter', () => {
  it('puts the rectangle center at the drop and uses half size', () => {
    expect(originFromCenter(100, 80, 96, 48)).toEqual({
      originXInches: 52,
      originYInches: 56,
    });
  });
});

describe('originFromGrabOffset', () => {
  it('keeps grab offset and does not snap the center onto the pointer', () => {
    // Origin 0,0; grab at 10,0 (a corner-ish point); move pointer to 40,20
    expect(originFromGrabOffset(0, 0, 10, 0, 40, 20)).toEqual({
      originXInches: 30,
      originYInches: 20,
    });
    // Center-snap would have set origin so center is at 40,20
    expect(originFromGrabOffset(0, 0, 10, 0, 40, 20).originXInches).not.toBe(
      originFromCenter(40, 20, 96, 48).originXInches,
    );
  });
});
