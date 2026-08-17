import { describe, expect, it } from 'vitest';
import { rotateBed90, localToPlan, bedPlanSize } from './rotate';

describe('rotateBed90', () => {
  it('cycles orientation without swapping stored length/width', () => {
    const bed = {
      originXInches: 10,
      originYInches: 20,
      lengthInches: 96,
      widthInches: 48,
      orientation: 0 as const,
    };
    const r90 = rotateBed90(bed);
    expect(r90.orientation).toBe(90);
    expect(r90.lengthInches).toBe(96);
    expect(r90.widthInches).toBe(48);
    expect(rotateBed90(r90).orientation).toBe(180);
    expect(rotateBed90(rotateBed90(r90)).orientation).toBe(270);
    expect(rotateBed90(rotateBed90(rotateBed90(r90))).orientation).toBe(0);
  });
});

describe('localToPlan', () => {
  it('maps local origin to bed origin at 0 degrees', () => {
    const bed = {
      originXInches: 5,
      originYInches: 7,
      lengthInches: 10,
      widthInches: 4,
      orientation: 0 as const,
    };
    expect(localToPlan(bed, 0, 0)).toEqual({ x: 5, y: 7 });
    expect(localToPlan(bed, 3, 1)).toEqual({ x: 8, y: 8 });
  });

  it('maps local coords at 90, 180, and 270 degrees', () => {
    const bed = {
      originXInches: 0,
      originYInches: 0,
      lengthInches: 10,
      widthInches: 4,
      orientation: 90 as const,
    };
    expect(localToPlan(bed, 0, 0)).toEqual({ x: 0, y: 10 });
    expect(localToPlan({ ...bed, orientation: 180 }, 0, 0)).toEqual({ x: 10, y: 4 });
    expect(localToPlan({ ...bed, orientation: 270 }, 0, 0)).toEqual({ x: 4, y: 0 });
  });
});

describe('bedPlanSize', () => {
  it('swaps displayed size at 90 and 270', () => {
    const bed = {
      originXInches: 0,
      originYInches: 0,
      lengthInches: 96,
      widthInches: 48,
      orientation: 0 as const,
    };
    expect(bedPlanSize(bed)).toEqual({ width: 96, height: 48 });
    expect(bedPlanSize({ ...bed, orientation: 90 })).toEqual({ width: 48, height: 96 });
  });
});
