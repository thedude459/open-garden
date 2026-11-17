import type { CropCoefficientsDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { addIsoDateDays } from './dates';
import { bedWaterFactor, kcOnDay, waterDue, WATER_DUE_MM, type DayWater } from './water-balance';

// Tomato in dataset v0.2: FAO-56 Table 12 coefficients, Table 11 stage lengths.
const tomato: CropCoefficientsDto = {
  initial: 0.6,
  mid: 1.15,
  end: 0.8,
  stageDays: { initial: 35, development: 40, mid: 50, late: 30 },
};

/** `n` days of weather from `start`, each the same unless `over` says otherwise. */
function days(
  start: string,
  n: number,
  et0Mm: number,
  over: Record<number, Partial<DayWater>> = {},
) {
  const out: Record<string, DayWater> = {};
  for (let i = 0; i < n; i++) out[addIsoDateDays(start, i)] = { et0Mm, rainMm: 0, ...over[i] };
  return out;
}

describe('kcOnDay (FAO-56 Eq. 66)', () => {
  it('holds initial, rises across development, holds mid, falls across late', () => {
    expect(kcOnDay(tomato, 0)).toBe(0.6);
    expect(kcOnDay(tomato, 34)).toBe(0.6);
    // Halfway through development (day 35 + 20): 0.6 + 0.5 × (1.15 − 0.6).
    expect(kcOnDay(tomato, 55)).toBeCloseTo(0.875, 10);
    expect(kcOnDay(tomato, 75)).toBe(1.15);
    expect(kcOnDay(tomato, 124)).toBe(1.15);
    // Halfway through late (day 125 + 15): 1.15 + 0.5 × (0.8 − 1.15).
    expect(kcOnDay(tomato, 140)).toBeCloseTo(0.975, 10);
    expect(kcOnDay(tomato, 155)).toBe(0.8);
    expect(kcOnDay(tomato, 400)).toBe(0.8);
  });

  it('stands at mid without stage lengths, and for a perennial', () => {
    expect(kcOnDay({ ...tomato, stageDays: null }, 3)).toBe(1.15);
    expect(kcOnDay(tomato, 3, false)).toBe(1.15);
  });
});

describe('bedWaterFactor', () => {
  it('scales by sun and mulch', () => {
    expect(bedWaterFactor('full', 'none')).toBe(1);
    expect(bedWaterFactor(null, null)).toBe(1);
    expect(bedWaterFactor('part', 'none')).toBeCloseTo(0.8, 10);
    expect(bedWaterFactor('shade', 'straw')).toBeCloseTo(0.54, 10);
    expect(bedWaterFactor('full', 'plastic')).toBeCloseTo(0.85, 10);
  });
});

describe('waterDue (FAO-56 Eq. 85, simplified)', () => {
  const base = {
    plantedOn: '2026-06-01',
    lastWateredOn: null,
    kc: tomato,
    annual: true,
    factor: 1,
  };

  it('is due the day the deficit reaches 25 mm', () => {
    // Initial stage, Kc 0.6, ET₀ 5 mm: 3 mm a day, 25 mm on the 9th day after planting.
    const weather = days('2026-06-01', 20, 5);
    expect(waterDue(base, weather, '2026-06-15')).toEqual({ dueOn: '2026-06-10', deficitMm: 27 });
    expect(WATER_DUE_MM).toBe(25);
  });

  it('starts again from the last watering', () => {
    const weather = days('2026-06-01', 20, 5);
    expect(waterDue({ ...base, lastWateredOn: '2026-06-10' }, weather, '2026-06-15')).toEqual({
      dueOn: '2026-06-19',
      deficitMm: 27,
    });
  });

  it('counts rain that reaches the roots, and never below a full soil', () => {
    // 20 mm of rain on day 4 refills the soil; counting starts again from zero.
    const weather = days('2026-06-01', 20, 5, { 4: { rainMm: 20 } });
    expect(waterDue(base, weather, '2026-06-15')).toEqual({ dueOn: '2026-06-14', deficitMm: 27 });
    // A shower below a fifth of ET₀ (0.9 of 5 mm) evaporates before it counts.
    const shower = days('2026-06-01', 20, 5, { 4: { rainMm: 0.9 } });
    expect(waterDue(base, shower, '2026-06-15')).toEqual({ dueOn: '2026-06-10', deficitMm: 27 });
  });

  it('uses less where the bed is shaded or mulched', () => {
    const weather = days('2026-06-01', 20, 5);
    // 3 mm × 0.6 = 1.8 mm a day: 25.2 mm on the 14th day.
    expect(waterDue({ ...base, factor: 0.6 }, weather, '2026-06-15')).toEqual({
      dueOn: '2026-06-15',
      deficitMm: 25,
    });
  });

  it('is not due within the forecast, and unknown with a gap before today', () => {
    const weather = days('2026-06-01', 5, 5);
    expect(waterDue(base, weather, '2026-06-03')).toBe('not-due');
    const gap = days('2026-06-01', 10, 5);
    delete gap['2026-06-03'];
    expect(waterDue(base, gap, '2026-06-05')).toBeNull();
    expect(waterDue(base, {}, '2026-06-05')).toBeNull();
  });

  it('counts from the first day the weather covers when planted long before', () => {
    const weather = days('2026-08-01', 37, 5);
    // Planted 1 June, so 1 August is day 61, in development: Kc 0.96 rising,
    // 4.8 mm a day rising to 5.1; 29.8 mm on 6 August.
    const due = waterDue(base, weather, '2026-08-31');
    expect(due).toEqual({ dueOn: '2026-08-06', deficitMm: 30 });
  });
});
