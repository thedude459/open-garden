import { describe, expect, it } from 'vitest';
import { computeWindows } from './windows';
import type { GrowingGuidanceDto } from '@open-garden/shared-types';

const tomatoGuidance: GrowingGuidanceDto = {
  indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
  outdoorSow: null,
  transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
};

const spinachGuidance: GrowingGuidanceDto = {
  indoorStart: null,
  outdoorSow: { frostAnchor: 'first', weeksEarliest: -8, weeksLatest: -6 },
  transplant: null,
};

const typicalFrost = {
  lastFrost: { month: 4, day: 15 },
  firstFrost: { month: 10, day: 20 },
};

describe('computeWindows', () => {
  it('shifts last-frost indoor/transplant as a range (Apr 15 tomato)', () => {
    const windows = computeWindows(typicalFrost, tomatoGuidance, 65);
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

  it('SC-003: same guidance with different last frost yields different indoor ranges', () => {
    const a = computeWindows(
      { lastFrost: { month: 4, day: 1 }, firstFrost: { month: 10, day: 20 } },
      tomatoGuidance,
      65,
    );
    const b = computeWindows(
      { lastFrost: { month: 5, day: 1 }, firstFrost: { month: 10, day: 20 } },
      tomatoGuidance,
      65,
    );
    expect(a.indoorStart?.earliest).not.toEqual(b.indoorStart?.earliest);
    expect(a.transplant?.earliest).not.toEqual(b.transplant?.earliest);
    expect(a.outdoorSow).toBeNull();
    expect(b.outdoorSow).toBeNull();
  });

  it('isolates last vs first frost: spinach sow ignores last frost', () => {
    const a = computeWindows(typicalFrost, spinachGuidance, 45);
    const shiftedLast = computeWindows(
      { lastFrost: { month: 5, day: 1 }, firstFrost: { month: 10, day: 20 } },
      spinachGuidance,
      45,
    );
    const shiftedFirst = computeWindows(
      { lastFrost: { month: 4, day: 15 }, firstFrost: { month: 11, day: 1 } },
      spinachGuidance,
      45,
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
      },
      null,
    );
    expect(windows.indoorStart?.earliest).toEqual(windows.indoorStart?.latest);
    expect(windows.harvest).toBeNull();
  });

  it('harvest prefers transplant, then sow, then indoor', () => {
    const fromTransplant = computeWindows(typicalFrost, tomatoGuidance, 10);
    expect(fromTransplant.harvest?.earliest).toEqual({ month: 5, day: 2 });

    const fromSow = computeWindows(
      typicalFrost,
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
        outdoorSow: { frostAnchor: 'last', weeksEarliest: 0, weeksLatest: 1 },
        transplant: null,
      },
      10,
    );
    expect(fromSow.harvest?.earliest).toEqual({ month: 4, day: 25 });

    const fromIndoor = computeWindows(
      typicalFrost,
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
        outdoorSow: null,
        transplant: null,
      },
      10,
    );
    expect(fromIndoor.harvest?.earliest).toEqual({ month: 2, day: 29 });
  });

  it('missing guidance or incomplete frost yields unavailable windows', () => {
    const noGuidance = computeWindows(typicalFrost, {
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
    }, 65);
    expect(noGuidance).toEqual({
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
      harvest: null,
    });

    const incomplete = computeWindows(
      { lastFrost: { month: 4, day: 15 }, firstFrost: null },
      tomatoGuidance,
      65,
    );
    expect(incomplete.indoorStart).toBeNull();
    expect(incomplete.harvest).toBeNull();
  });

  it('does not clip ranges to frost dates', () => {
    const windows = computeWindows(typicalFrost, tomatoGuidance, 65);
    expect(windows.indoorStart?.latest).toEqual({ month: 3, day: 4 });
    expect(windows.transplant?.earliest).toEqual({ month: 4, day: 22 });
  });

  it('keeps Feb 29 in the leap-safe reference year', () => {
    const windows = computeWindows(
      { lastFrost: { month: 2, day: 29 }, firstFrost: { month: 10, day: 1 } },
      {
        indoorStart: { frostAnchor: 'last', weeksEarliest: 0, weeksLatest: 0 },
        outdoorSow: null,
        transplant: null,
      },
      null,
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
      },
      null,
    );
    expect(windows.indoorStart?.wrapsYear).toBe(true);
    expect(windows.indoorStart?.earliest.month).toBe(12);
    expect(windows.indoorStart?.latest.month).toBe(1);
  });
});
