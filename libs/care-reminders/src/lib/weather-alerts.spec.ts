import { describe, expect, it } from 'vitest';
import { weatherAlerts, type AlertPlanting } from './weather-alerts';

const tomato: AlertPlanting = {
  name: 'Tomato',
  bedName: 'North',
  frostTolerance: 'tender',
  growMaxC: 35,
};
const lettuce: AlertPlanting = {
  name: 'Lettuce',
  bedName: 'South',
  frostTolerance: 'half-hardy',
  growMaxC: 24,
};
const kale: AlertPlanting = {
  name: 'Kale',
  bedName: 'South',
  frostTolerance: 'hardy',
  growMaxC: 27,
};
const unknown: AlertPlanting = {
  name: 'Custom',
  bedName: null,
  frostTolerance: null,
  growMaxC: null,
};
const day = (minC: number, maxC: number) => ({ minC, maxC });

describe('weatherAlerts', () => {
  it('warns about tender crops on the first night at or below 1 °C', () => {
    const alerts = weatherAlerts(
      [tomato, lettuce, kale, unknown],
      { '2026-11-17': day(4, 12), '2026-11-18': day(1, 9), '2026-11-19': day(-1, 8) },
      '2026-11-17',
    );
    expect(alerts).toEqual([
      {
        kind: 'frost',
        date: '2026-11-18',
        tempC: 1,
        plantings: [{ name: 'Tomato', bedName: 'North' }],
      },
    ]);
  });

  it('adds half-hardy crops at a hard frost, and never warns about hardy ones', () => {
    const [frost] = weatherAlerts(
      [tomato, lettuce, kale],
      { '2026-11-18': day(-3, 4) },
      '2026-11-17',
    );
    expect(frost!.plantings.map((p) => p.name)).toEqual(['Tomato', 'Lettuce']);
    expect(weatherAlerts([kale], { '2026-11-18': day(-10, 0) }, '2026-11-17')).toEqual([]);
  });

  it('warns about heat above a crop’s growing range, separately from frost', () => {
    const alerts = weatherAlerts(
      [tomato, lettuce],
      { '2026-07-01': day(18, 24), '2026-07-02': day(20, 30) },
      '2026-07-01',
    );
    expect(alerts).toEqual([
      {
        kind: 'heat',
        date: '2026-07-02',
        tempC: 30,
        plantings: [{ name: 'Lettuce', bedName: 'South' }],
      },
    ]);
  });

  it('ignores past days, lists a plant once per bed, and says nothing without a forecast', () => {
    const twice = [tomato, { ...tomato }, { ...tomato, bedName: 'East' }];
    const [frost] = weatherAlerts(
      twice,
      { '2026-11-16': day(-5, 2), '2026-11-17': day(0, 5) },
      '2026-11-17',
    );
    expect(frost).toMatchObject({ date: '2026-11-17' });
    expect(frost!.plantings).toEqual([
      { name: 'Tomato', bedName: 'North' },
      { name: 'Tomato', bedName: 'East' },
    ]);
    expect(weatherAlerts([tomato], null, '2026-11-17')).toEqual([]);
    expect(weatherAlerts([], { '2026-11-17': day(-5, 40) }, '2026-11-17')).toEqual([]);
  });
});
