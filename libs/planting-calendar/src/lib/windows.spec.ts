import { describe, expect, it } from 'vitest';
import { computeWindows, seasonYear, windowsAvailable } from './windows';
import type { GrowingGuidanceDto } from '@open-garden/shared-types';

const tomatoGuidance: GrowingGuidanceDto = {
  indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
  outdoorSow: null,
  transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
  fallSow: null,
};

const spinachGuidance: GrowingGuidanceDto = {
  indoorStart: null,
  outdoorSow: { frostAnchor: 'first', weeksEarliest: -8, weeksLatest: -6 },
  transplant: null,
  fallSow: null,
};

const typicalFrost = {
  lastFrost: { month: 4, day: 15 },
  firstFrost: { month: 10, day: 20 },
};

describe('computeWindows', () => {
  it('shifts last-frost indoor/transplant as a range (Apr 15 tomato)', () => {
    const windows = computeWindows(typicalFrost, tomatoGuidance, 65, 2024);
    expect(windows.indoorStart).toEqual({
      earliest: { month: 2, day: 19 },
      latest: { month: 3, day: 4 },
      wrapsYear: false,
    });
    expect(windows.transplant).toEqual({
      earliest: { month: 4, day: 22 },
      latest: { month: 4, day: 29 },
      wrapsYear: false,
    });
    expect(windows.outdoorSow).toBeNull();
    expect(windows.harvest).toEqual({
      earliest: { month: 6, day: 26 },
      latest: { month: 7, day: 3 },
      wrapsYear: false,
    });
  });

  it('counts a fall sowing back from the first frost', () => {
    const lettuce: GrowingGuidanceDto = {
      ...spinachGuidance,
      fallSow: { frostAnchor: 'first', weeksEarliest: -8, weeksLatest: -4 },
    };
    expect(computeWindows(typicalFrost, lettuce, 45, 2024).fallSow).toEqual({
      earliest: { month: 8, day: 25 },
      latest: { month: 9, day: 22 },
      wrapsYear: false,
    });
  });

  it('SC-003: same guidance with different last frost yields different indoor ranges', () => {
    const a = computeWindows(
      { lastFrost: { month: 4, day: 1 }, firstFrost: { month: 10, day: 20 } },
      tomatoGuidance,
      65,
      2024,
    );
    const b = computeWindows(
      { lastFrost: { month: 5, day: 1 }, firstFrost: { month: 10, day: 20 } },
      tomatoGuidance,
      65,
      2024,
    );
    expect(a.indoorStart?.earliest).not.toEqual(b.indoorStart?.earliest);
    expect(a.transplant?.earliest).not.toEqual(b.transplant?.earliest);
    expect(a.outdoorSow).toBeNull();
    expect(b.outdoorSow).toBeNull();
  });

  it('isolates last vs first frost: spinach sow ignores last frost', () => {
    const a = computeWindows(typicalFrost, spinachGuidance, 45, 2024);
    const shiftedLast = computeWindows(
      { lastFrost: { month: 5, day: 1 }, firstFrost: { month: 10, day: 20 } },
      spinachGuidance,
      45,
      2024,
    );
    const shiftedFirst = computeWindows(
      { lastFrost: { month: 4, day: 15 }, firstFrost: { month: 11, day: 1 } },
      spinachGuidance,
      45,
      2024,
    );
    expect(a.outdoorSow).toEqual(shiftedLast.outdoorSow);
    expect(a.outdoorSow).not.toEqual(shiftedFirst.outdoorSow);
    expect(a.outdoorSow).toEqual({
      earliest: { month: 8, day: 25 },
      latest: { month: 9, day: 8 },
      wrapsYear: false,
    });
  });

  it('stores a single catalog number as a same-day range', () => {
    const windows = computeWindows(
      typicalFrost,
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -4, weeksLatest: -4 },
        outdoorSow: null,
        transplant: null,
        fallSow: null,
      },
      null,
      2024,
    );
    expect(windows.indoorStart?.earliest).toEqual(windows.indoorStart?.latest);
    expect(windows.harvest).toBeNull();
  });

  it('harvest prefers transplant, then sow, then indoor', () => {
    const fromTransplant = computeWindows(typicalFrost, tomatoGuidance, 10, 2024);
    expect(fromTransplant.harvest?.earliest).toEqual({ month: 5, day: 2 });

    const fromSow = computeWindows(
      typicalFrost,
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
        outdoorSow: { frostAnchor: 'last', weeksEarliest: 0, weeksLatest: 1 },
        transplant: null,
        fallSow: null,
      },
      10,
      2024,
    );
    expect(fromSow.harvest?.earliest).toEqual({ month: 4, day: 25 });

    const fromIndoor = computeWindows(
      typicalFrost,
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
        outdoorSow: null,
        transplant: null,
        fallSow: null,
      },
      10,
      2024,
    );
    expect(fromIndoor.harvest?.earliest).toEqual({ month: 2, day: 29 });
  });

  it('missing guidance or incomplete frost yields unavailable windows', () => {
    const noGuidance = computeWindows(
      typicalFrost,
      {
        indoorStart: null,
        outdoorSow: null,
        transplant: null,
        fallSow: null,
      },
      65,
      2024,
    );
    expect(noGuidance).toEqual({
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
      fallSow: null,
      harvest: null,
    });

    const incomplete = computeWindows(
      { lastFrost: { month: 4, day: 15 }, firstFrost: null },
      tomatoGuidance,
      65,
      2024,
    );
    expect(incomplete.indoorStart).toBeNull();
    expect(incomplete.harvest).toBeNull();
  });

  it('does not clip ranges to frost dates', () => {
    const windows = computeWindows(typicalFrost, tomatoGuidance, 65, 2024);
    expect(windows.indoorStart?.latest).toEqual({ month: 3, day: 4 });
    expect(windows.transplant?.earliest).toEqual({ month: 4, day: 22 });
  });

  it('keeps a 29 February frost day in a leap year', () => {
    const windows = computeWindows(
      { lastFrost: { month: 2, day: 29 }, firstFrost: { month: 10, day: 1 } },
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: 0, weeksLatest: 0 },
        outdoorSow: null,
        transplant: null,
        fallSow: null,
      },
      null,
      2024,
    );
    expect(windows.indoorStart).toEqual({
      earliest: { month: 2, day: 29 },
      latest: { month: 2, day: 29 },
      wrapsYear: false,
    });
  });

  it('marks wrapsYear when a range crosses 31 Dec', () => {
    const windows = computeWindows(
      { lastFrost: { month: 1, day: 5 }, firstFrost: { month: 10, day: 20 } },
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -4, weeksLatest: 1 },
        outdoorSow: null,
        transplant: null,
        fallSow: null,
      },
      null,
      2024,
    );
    expect(windows.indoorStart?.wrapsYear).toBe(true);
    expect(windows.indoorStart?.earliest.month).toBe(12);
    expect(windows.indoorStart?.latest.month).toBe(1);
  });

  it('counts days in the real year, so 29 February only shifts leap years', () => {
    // 8 weeks before 15 April: 19 February in 2024, 18 February in 2025.
    expect(computeWindows(typicalFrost, tomatoGuidance, 65, 2024).indoorStart?.earliest).toEqual({
      month: 2,
      day: 19,
    });
    expect(computeWindows(typicalFrost, tomatoGuidance, 65, 2025).indoorStart?.earliest).toEqual({
      month: 2,
      day: 18,
    });
  });

  it('works out a southern season that wraps the year end', () => {
    const south = { lastFrost: { month: 9, day: 15 }, firstFrost: { month: 5, day: 10 } };
    const tomato = computeWindows(south, tomatoGuidance, 65, 2025);
    expect(tomato.transplant).toEqual({
      earliest: { month: 9, day: 22 },
      latest: { month: 9, day: 29 },
      wrapsYear: false,
    });
    expect(tomato.harvest).toEqual({
      earliest: { month: 11, day: 26 },
      latest: { month: 12, day: 3 },
      wrapsYear: false,
    });
    // Autumn spinach counts back from first frost on 10 May 2026, across no leap day.
    expect(computeWindows(south, spinachGuidance, 45, 2025).outdoorSow).toEqual({
      earliest: { month: 3, day: 15 },
      latest: { month: 3, day: 29 },
      wrapsYear: false,
    });
    // The same in a season whose autumn falls in leap year 2028.
    expect(computeWindows(south, spinachGuidance, 45, 2027).outdoorSow?.earliest).toEqual({
      month: 3,
      day: 15,
    });
  });
});

describe('seasonYear', () => {
  const north = { lastFrost: { month: 4, day: 15 }, firstFrost: { month: 10, day: 20 } };
  const south = { lastFrost: { month: 9, day: 15 }, firstFrost: { month: 5, day: 10 } };

  it('is this year in the north', () => {
    expect(seasonYear(north, new Date(2026, 0, 5))).toBe(2026);
    expect(seasonYear(north, new Date(2026, 11, 5))).toBe(2026);
  });

  it('is last year in the south until that season reaches first frost', () => {
    expect(seasonYear(south, new Date(2026, 1, 1))).toBe(2025);
    expect(seasonYear(south, new Date(2026, 4, 10))).toBe(2025);
    expect(seasonYear(south, new Date(2026, 4, 11))).toBe(2026);
    expect(seasonYear({ lastFrost: null, firstFrost: null }, new Date(2026, 1, 1))).toBe(2026);
  });
});

describe('windows where it rarely frosts', () => {
  const noFrost = { lastFrost: null, firstFrost: null };
  // Honolulu-like: 23–27 °C all year, coolest in winter.
  const warm = [23, 23, 23, 24, 25, 26, 27, 27, 27, 26, 25, 24];
  const tomatoTemps = { minC: 10, maxC: 35, minSoilC: 16 };
  const lettuceTemps = { minC: 4, maxC: 24, minSoilC: 4 };

  it('plants a warm crop all year, from the crop’s own method', () => {
    const w = computeWindows(noFrost, tomatoGuidance, 65, 2026, {
      monthlyMeanC: warm,
      sowingTemperature: tomatoTemps,
    });
    expect(w.transplant).toEqual({
      earliest: { month: 1, day: 1 },
      latest: { month: 12, day: 31 },
      wrapsYear: false,
    });
    expect(w.outdoorSow).toBeNull();
    expect(w.indoorStart).toBeNull();
    expect(w.harvest?.earliest).toEqual({ month: 3, day: 7 });
  });

  it('gives a cool crop the cooler months, across the year end', () => {
    const fall = { frostAnchor: 'first' as const, weeksEarliest: -8, weeksLatest: -4 };
    const w = computeWindows(noFrost, { ...spinachGuidance, fallSow: fall }, 45, 2026, {
      monthlyMeanC: warm,
      sowingTemperature: lettuceTemps,
    });
    expect(w.outdoorSow).toEqual({
      earliest: { month: 12, day: 1 },
      latest: { month: 4, day: 30 },
      wrapsYear: true,
    });
    // A fall sowing counts from a frost that does not come here.
    expect(w.fallSow).toBeNull();
  });

  it('takes the longer of two runs of suitable months', () => {
    // Cool in Jan–Mar and again in Oct–Nov; too hot in between and in December.
    const twoSeasons = [20, 20, 20, 30, 30, 30, 30, 30, 30, 20, 20, 30];
    expect(Math.min(...twoSeasons)).toBeGreaterThanOrEqual(7);
    const w = computeWindows(noFrost, spinachGuidance, null, 2026, {
      monthlyMeanC: twoSeasons,
      sowingTemperature: lettuceTemps,
    });
    expect(w.outdoorSow).toEqual({
      earliest: { month: 1, day: 1 },
      latest: { month: 3, day: 31 },
      wrapsYear: false,
    });
  });

  it('gives no window when no month suits, or the crop or place has no temperatures', () => {
    const empty = {
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
      fallSow: null,
      harvest: null,
    };
    const hot = new Array<number>(12).fill(30);
    expect(
      computeWindows(noFrost, spinachGuidance, 45, 2026, {
        monthlyMeanC: hot,
        sowingTemperature: lettuceTemps,
      }),
    ).toEqual(empty);
    expect(
      computeWindows(noFrost, tomatoGuidance, 65, 2026, {
        monthlyMeanC: warm,
        sowingTemperature: null,
      }),
    ).toEqual(empty);
    expect(computeWindows(noFrost, tomatoGuidance, 65, 2026)).toEqual(empty);
  });

  it('uses frost dates whenever the property has both', () => {
    const w = computeWindows(typicalFrost, tomatoGuidance, 65, 2024, {
      monthlyMeanC: warm,
      sowingTemperature: tomatoTemps,
    });
    expect(w.transplant?.earliest).toEqual({ month: 4, day: 22 });
  });

  it('has windows with frost dates, or monthly temperatures where frost is rare', () => {
    expect(windowsAvailable(typicalFrost, null)).toBe(true);
    expect(windowsAvailable(noFrost, warm)).toBe(true);
    expect(windowsAvailable(noFrost, null)).toBe(false);
    expect(windowsAvailable(noFrost, [20])).toBe(false);
    // Frost dates cleared in a place with cold winters: no temperature windows.
    const temperate = [2, 4, 9, 14, 20, 25, 27, 26, 22, 15, 10, 4];
    expect(windowsAvailable(noFrost, temperate)).toBe(false);
    expect(
      computeWindows(noFrost, tomatoGuidance, 65, 2026, {
        monthlyMeanC: temperate,
        sowingTemperature: tomatoTemps,
      }).transplant,
    ).toBeNull();
  });
});
