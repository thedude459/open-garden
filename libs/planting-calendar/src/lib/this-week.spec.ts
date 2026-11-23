import { describe, expect, it } from 'vitest';
import { suggestedPlannedOn, overlapsThisWeek } from './this-week';
import type { SeasonalWindowDto } from '@open-garden/shared-types';

const indoor: SeasonalWindowDto = {
  earliest: { month: 2, day: 19 },
  latest: { month: 3, day: 4 },
  wrapsYear: false,
};
const harvest: SeasonalWindowDto = {
  earliest: { month: 6, day: 26 },
  latest: { month: 7, day: 3 },
  wrapsYear: false,
};
const wrap: SeasonalWindowDto = {
  earliest: { month: 12, day: 28 },
  latest: { month: 1, day: 3 },
  wrapsYear: true,
};

describe('overlapsThisWeek', () => {
  it('treats this week as local today through today+6', () => {
    const today = new Date(2026, 1, 20);
    expect(overlapsThisWeek([indoor], today)).toBe(true);
    expect(overlapsThisWeek([indoor], new Date(2026, 1, 18))).toBe(true);
    expect(overlapsThisWeek([indoor], new Date(2026, 2, 5))).toBe(false);
  });

  it('does not count harvest-only overlap', () => {
    const today = new Date(2026, 5, 28);
    expect(overlapsThisWeek([indoor, null, null], today)).toBe(false);
    expect(overlapsThisWeek([harvest], today)).toBe(true);
  });

  it('ignores unavailable windows', () => {
    expect(overlapsThisWeek([null, undefined], new Date(2026, 1, 20))).toBe(false);
  });

  it('handles December–January wrap across the local week', () => {
    expect(overlapsThisWeek([wrap], new Date(2026, 11, 30))).toBe(true);
    expect(overlapsThisWeek([wrap], new Date(2026, 0, 2))).toBe(true);
    expect(overlapsThisWeek([wrap], new Date(2026, 0, 10))).toBe(false);
  });
});

describe('suggestedPlannedOn (ADR 0040)', () => {
  const w = (from: [number, number], to: [number, number], wrapsYear = false) => ({
    earliest: { month: from[0], day: from[1] },
    latest: { month: to[0], day: to[1] },
    wrapsYear,
  });
  const windows = {
    indoorStart: w([2, 15], [3, 1]),
    outdoorSow: w([4, 1], [4, 30]),
    transplant: w([5, 1], [5, 20]),
    fallSow: w([8, 15], [9, 10]),
    harvest: null,
  };

  it('plans the next window’s first day, by start method', () => {
    const march = new Date(2027, 2, 10);
    expect(suggestedPlannedOn(windows, 'direct_seed', 2027, march)).toBe('2027-04-01');
    expect(suggestedPlannedOn(windows, 'transplant', 2027, march)).toBe('2027-05-01');
  });

  it('plans today while a window is open, then the fall window, then nothing', () => {
    expect(suggestedPlannedOn(windows, 'direct_seed', 2027, new Date(2027, 3, 12))).toBe(
      '2027-04-12',
    );
    expect(suggestedPlannedOn(windows, 'direct_seed', 2027, new Date(2027, 5, 1))).toBe(
      '2027-08-15',
    );
    expect(suggestedPlannedOn(windows, 'direct_seed', 2027, new Date(2027, 10, 1))).toBeNull();
    // Next season, planned in November: next spring.
    expect(suggestedPlannedOn(windows, 'direct_seed', 2028, new Date(2027, 10, 1))).toBe(
      '2028-04-01',
    );
  });

  it('follows a window across the year end, and gives nothing without windows', () => {
    const wrap = { ...windows, outdoorSow: w([12, 1], [1, 31], true), fallSow: null };
    expect(suggestedPlannedOn(wrap, 'direct_seed', 2026, new Date(2027, 0, 5))).toBe('2027-01-05');
    const none = { ...windows, outdoorSow: null, fallSow: null };
    expect(suggestedPlannedOn(none, 'direct_seed', 2027, new Date(2027, 2, 1))).toBeNull();
  });
});
