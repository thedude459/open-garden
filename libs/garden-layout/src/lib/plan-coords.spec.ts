import { describe, expect, it } from 'vitest';
import { localToPlan, type RotatableBed } from './rotate';
import { clientToPlanWithPanScale, planToLocal, roundTripLocal } from './plan-coords';

function bed(orientation: RotatableBed['orientation']): RotatableBed {
  return {
    originXInches: 10,
    originYInches: 20,
    lengthInches: 96,
    widthInches: 48,
    orientation,
  };
}

describe('planToLocal', () => {
  it.each([0, 90, 180, 270] as const)(
    'round-trips local coords at %s degrees',
    (orientation) => {
      const geo = bed(orientation);
      const samples = [
        [0, 0],
        [12, 6],
        [96, 48],
        [40, 20],
      ] as const;
      for (const [lx, ly] of samples) {
        const plan = localToPlan(geo, lx, ly);
        expect(planToLocal(geo, plan.x, plan.y)).toEqual({ x: lx, y: ly });
      }
    },
  );

  it('returns integer inches', () => {
    const geo = bed(0);
    expect(planToLocal(geo, 10.4, 20.6)).toEqual({ x: 0, y: 1 });
    expect(roundTripLocal(geo, 12, 6)).toEqual({ x: 12, y: 6 });
  });
});

describe('clientToPlanWithPanScale', () => {
  it('maps the viewport center the same way as a pan of zero at scale 1', () => {
    expect(clientToPlanWithPanScale(100, 50, 0, 0, 0, 0, 1, 1)).toEqual({ x: 100, y: 50 });
  });

  it('accounts for pan and scale', () => {
    expect(clientToPlanWithPanScale(100, 50, 0, 0, 40, -20, 2, 1)).toEqual({ x: 30, y: 35 });
    expect(clientToPlanWithPanScale(120, 80, 20, 10, 0, 0, 0.5, 2)).toEqual({ x: 100, y: 70 });
  });
});
