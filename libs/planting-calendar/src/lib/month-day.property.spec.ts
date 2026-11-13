// Property-based tests (fast-check) for the month/day arithmetic behind sowing
// and transplant windows.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, addWeeks, mdKey } from './month-day';

/** Any day of a leap year, so 29 February is included. */
const monthDay = fc
  .date({
    min: new Date('2024-01-01T00:00:00Z'),
    max: new Date('2024-12-31T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((d) => ({ month: d.getUTCMonth() + 1, day: d.getUTCDate() }));

describe('month/day arithmetic (properties)', () => {
  it('adding then subtracting days returns the start day in any year', () => {
    fc.assert(
      fc.property(
        monthDay,
        fc.integer({ min: 2020, max: 2031 }),
        fc.integer({ min: -400, max: 400 }),
        (md, year, n) => {
          fc.pre(!(md.month === 2 && md.day === 29) || year % 4 === 0);
          const there = addDays(md, n, year);
          const back = addDays({ month: there.month, day: there.day }, -n, there.year);
          expect(back).toEqual({ ...md, year });
        },
      ),
    );
  });

  it('w weeks is the same as 7w days', () => {
    fc.assert(
      fc.property(monthDay, fc.integer({ min: -60, max: 60 }), (md, w) => {
        expect(addWeeks(md, w, 2025)).toEqual(addDays(md, 7 * w, 2025));
      }),
    );
  });

  it('mdKey orders days the same way the calendar does', () => {
    fc.assert(
      fc.property(monthDay, monthDay, (a, b) => {
        const byDate = Date.UTC(2024, a.month - 1, a.day) - Date.UTC(2024, b.month - 1, b.day);
        expect(Math.sign(mdKey(a) - mdKey(b))).toBe(Math.sign(byDate));
      }),
    );
  });

  it('adding zero days changes nothing', () => {
    fc.assert(
      fc.property(monthDay, (md) => {
        const same = addDays(md, 0, 2024);
        expect({ month: same.month, day: same.day }).toEqual(md);
      }),
    );
  });
});
