import { describe, expect, it } from 'vitest';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';
import {
  FixtureTemperatureOutlook,
  OpenMeteoTemperatureOutlook,
  parseDayTemperatures,
  temperatureOutlookFor,
} from './temperature-outlook';

describe('temperature outlook', () => {
  it('reads daily lows and highs, skipping days with a missing value', () => {
    expect(
      parseDayTemperatures({
        daily: {
          time: ['2026-11-17', '2026-11-18', '2026-11-19'],
          temperature_2m_min: [3.1, -1.4, null],
          temperature_2m_max: [12, 7.5, 9],
        },
      }),
    ).toEqual({
      '2026-11-17': { minC: 3.1, maxC: 12 },
      '2026-11-18': { minC: -1.4, maxC: 7.5 },
    });
    expect(
      parseDayTemperatures({ daily: { time: ['2026-11-17'], temperature_2m_min: [1] } }),
    ).toBeNull();
    expect(parseDayTemperatures({})).toBeNull();
  });

  it('is the live forecast only when places are live', () => {
    expect(temperatureOutlookFor({ PLACE_PROVIDER: 'live' })).toBeInstanceOf(
      OpenMeteoTemperatureOutlook,
    );
    expect(temperatureOutlookFor({})).toBeInstanceOf(FixtureTemperatureOutlook);
  });

  it('fixture: frost tomorrow at the Washington point, mild elsewhere', async () => {
    const outlook = new FixtureTemperatureOutlook();
    const dc = await outlook.daily(
      WASHINGTON_PLACE.latitude,
      WASHINGTON_PLACE.longitude,
      '2026-11-17',
    );
    expect(dc['2026-11-18']).toEqual({ minC: -2, maxC: 8 });
    expect(dc['2026-11-17']!.minC).toBeGreaterThan(5);
    const other = MAIN_STREET_PLACES[1]!;
    const mild = await outlook.daily(other.latitude, other.longitude, '2026-11-17');
    expect(Object.values(mild).every((d) => d.minC > 5)).toBe(true);
    expect(Object.keys(mild)).toHaveLength(4);
  });
});
