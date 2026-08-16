import { describe, expect, it } from 'vitest';
import { overlapsThisWeek } from './this-week';
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
