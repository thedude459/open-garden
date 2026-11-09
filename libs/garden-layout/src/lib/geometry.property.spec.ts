// Property-based tests (fast-check): rules that must hold for every bed, every
// orientation, and every point — not just the examples in the other specs.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { BedOrientation } from '@open-garden/shared-types';
import { bedPlanSize, localToPlan, rotateBed90, type RotatableBed } from './rotate';
import { planToLocal, roundTripLocal } from './plan-coords';

const orientation = fc.constantFrom<BedOrientation>(0, 90, 180, 270);

const bed: fc.Arbitrary<RotatableBed> = fc.record({
  originXInches: fc.integer({ min: -2000, max: 2000 }),
  originYInches: fc.integer({ min: -2000, max: 2000 }),
  lengthInches: fc.integer({ min: 1, max: 600 }),
  widthInches: fc.integer({ min: 1, max: 600 }),
  orientation,
});

/** A bed plus an integer point inside it, in the bed's own coordinates. */
const bedWithPoint = bed.chain((b) =>
  fc.record({
    bed: fc.constant(b),
    x: fc.integer({ min: 0, max: b.lengthInches }),
    y: fc.integer({ min: 0, max: b.widthInches }),
  }),
);

describe('bed geometry (properties)', () => {
  it('plan → local undoes local → plan for every orientation', () => {
    fc.assert(
      fc.property(bedWithPoint, ({ bed: b, x, y }) => {
        expect(roundTripLocal(b, x, y)).toEqual({ x, y });
      }),
    );
  });

  it('a point inside a bed lands inside the bed’s rectangle on the plan', () => {
    fc.assert(
      fc.property(bedWithPoint, ({ bed: b, x, y }) => {
        const p = localToPlan(b, x, y);
        const size = bedPlanSize(b);
        expect(p.x).toBeGreaterThanOrEqual(b.originXInches);
        expect(p.x).toBeLessThanOrEqual(b.originXInches + size.width);
        expect(p.y).toBeGreaterThanOrEqual(b.originYInches);
        expect(p.y).toBeLessThanOrEqual(b.originYInches + size.height);
      }),
    );
  });

  it('local → plan is one-to-one: different points never land on the same spot', () => {
    fc.assert(
      fc.property(
        bed.chain((b) =>
          fc.record({
            bed: fc.constant(b),
            a: fc.tuple(
              fc.integer({ min: 0, max: b.lengthInches }),
              fc.integer({ min: 0, max: b.widthInches }),
            ),
            c: fc.tuple(
              fc.integer({ min: 0, max: b.lengthInches }),
              fc.integer({ min: 0, max: b.widthInches }),
            ),
          }),
        ),
        ({ bed: b, a, c }) => {
          fc.pre(a[0] !== c[0] || a[1] !== c[1]);
          expect(localToPlan(b, a[0], a[1])).not.toEqual(localToPlan(b, c[0], c[1]));
        },
      ),
    );
  });

  it('four 90° turns return the original bed; area never changes', () => {
    fc.assert(
      fc.property(bed, (b) => {
        const turned = rotateBed90(rotateBed90(rotateBed90(rotateBed90(b))));
        expect(turned).toEqual(b);
        const size = bedPlanSize(b);
        const once = bedPlanSize(rotateBed90(b));
        expect(once.width * once.height).toBe(size.width * size.height);
        expect(once).toEqual({ width: size.height, height: size.width });
      }),
    );
  });

  it('planToLocal maps the bed’s plan corners back to its local corners', () => {
    fc.assert(
      fc.property(bed, (b) => {
        for (const [x, y] of [
          [0, 0],
          [b.lengthInches, 0],
          [0, b.widthInches],
          [b.lengthInches, b.widthInches],
        ] as const) {
          const p = localToPlan(b, x, y);
          expect(planToLocal(b, p.x, p.y)).toEqual({ x, y });
        }
      }),
    );
  });
});
