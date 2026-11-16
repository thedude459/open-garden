import type { GrowingGuidanceDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { plantTimeline } from './plant-timeline';

const guidance: GrowingGuidanceDto = {
  indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
  outdoorSow: null,
  transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
  fallSow: null,
};
const tomato = { growingGuidance: guidance, sowingTemperature: null, daysToMaturity: 65 };
const frosty = {
  lastFrost: { month: 4, day: 15 },
  firstFrost: { month: 10, day: 20 },
  monthlyMeanC: null,
};

describe('plantTimeline', () => {
  it('lays a crop’s windows across the year in order, with harvest last', () => {
    const rows = plantTimeline(frosty, tomato, new Date(2025, 2, 1))!;
    expect(rows.map((r) => r.label)).toEqual(['Start indoors', 'Plant out', 'Harvest']);
    const indoor = rows[0]!;
    expect(indoor.window.earliest).toEqual({ month: 2, day: 18 });
    // 18 February is day 48 of 365; the window runs two weeks.
    expect(indoor.spans).toHaveLength(1);
    expect(indoor.spans[0]!.startPct).toBeCloseTo((48 / 365) * 100);
    expect(indoor.spans[0]!.widthPct).toBeCloseTo((15 / 365) * 100);
  });

  it('splits a window over the year end into two spans', () => {
    const south = { lastFrost: { month: 9, day: 15 }, firstFrost: { month: 4, day: 20 } };
    // Planted out 22–29 September; 100 days on is 31 December to 7 January.
    const slow = { ...tomato, daysToMaturity: 100 };
    const rows = plantTimeline({ ...south, monthlyMeanC: null }, slow, new Date(2025, 9, 1))!;
    const harvest = rows.find((r) => r.kind === 'harvest')!;
    expect(harvest.window.wrapsYear).toBe(true);
    expect(harvest.spans).toHaveLength(2);
    expect(harvest.spans[1]!.startPct).toBe(0);
  });

  it('is null where nothing places the windows', () => {
    const bare = { lastFrost: null, firstFrost: null, monthlyMeanC: null };
    expect(plantTimeline(bare, tomato, new Date(2025, 2, 1))).toBeNull();
  });
});
