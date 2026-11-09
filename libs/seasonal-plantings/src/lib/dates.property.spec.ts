// Property-based tests (fast-check) for planting and harvest dates.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { assertDatePair, isIsoDate } from './dates';

/** Any real calendar day from 1900 to 2199, as YYYY-MM-DD. */
const isoDay = fc
  .date({
    min: new Date('1900-01-01T00:00:00Z'),
    max: new Date('2199-12-31T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

describe('planting dates (properties)', () => {
  it('accepts every real calendar day', () => {
    fc.assert(
      fc.property(isoDay, (day) => {
        expect(isIsoDate(day)).toBe(true);
      }),
    );
  });

  it('rejects impossible months and days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2199 }),
        fc.oneof(fc.integer({ min: 13, max: 99 }), fc.constant(0)),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          expect(isIsoDate(text)).toBe(false);
        },
      ),
    );
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2199 }), (year) => {
        expect(isIsoDate(`${year}-04-31`)).toBe(false);
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        expect(isIsoDate(`${year}-02-29`)).toBe(leap);
      }),
    );
  });

  it('rejects a harvest before planting, and only then', () => {
    fc.assert(
      fc.property(isoDay, isoDay, (planted, harvested) => {
        if (harvested < planted) {
          expect(() => assertDatePair(planted, harvested)).toThrow();
        } else {
          expect(() => assertDatePair(planted, harvested)).not.toThrow();
        }
      }),
    );
  });

  it('either date alone is always fine', () => {
    fc.assert(
      fc.property(isoDay, fc.constantFrom(null, undefined), (day, missing) => {
        expect(() => assertDatePair(day, missing)).not.toThrow();
        expect(() => assertDatePair(missing, day)).not.toThrow();
      }),
    );
  });
});
