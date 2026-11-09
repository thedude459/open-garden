// Property-based tests (fast-check) for the frost-date pair stored on a garden.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { keepFrostPair, zoneNumberFromLabel } from './climate';

const anyMonthDay = fc.record({
  month: fc.integer({ min: -2, max: 15 }),
  day: fc.integer({ min: -2, max: 35 }),
});
const maybe = <T>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: null });

describe('frost dates (properties)', () => {
  it('keeps both dates or neither', () => {
    fc.assert(
      fc.property(maybe(anyMonthDay), maybe(anyMonthDay), (last, first) => {
        const out = keepFrostPair(last, first);
        expect(out.last === null).toBe(out.first === null);
      }),
    );
  });

  it('a kept pair is the input, valid, with last frost before first frost', () => {
    fc.assert(
      fc.property(maybe(anyMonthDay), maybe(anyMonthDay), (last, first) => {
        const out = keepFrostPair(last, first);
        if (out.last === null || out.first === null) return;
        expect(out).toEqual({ last, first });
        for (const md of [out.last, out.first]) {
          expect(md.month).toBeGreaterThanOrEqual(1);
          expect(md.month).toBeLessThanOrEqual(12);
          expect(md.day).toBeGreaterThanOrEqual(1);
          expect(md.day).toBeLessThanOrEqual(31);
        }
        expect(out.last.month * 100 + out.last.day).toBeLessThan(
          out.first.month * 100 + out.first.day,
        );
      }),
    );
  });

  it('a zone label yields 1–13 or nothing', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer({ min: -5, max: 20 }).map(String), fc.constant(null)),
        (label) => {
          const zone = zoneNumberFromLabel(label);
          if (zone !== null) {
            expect(Number.isInteger(zone)).toBe(true);
            expect(zone).toBeGreaterThanOrEqual(1);
            expect(zone).toBeLessThanOrEqual(13);
          }
        },
      ),
    );
  });
});
