import { describe, expect, it } from 'vitest';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';
import { FixtureRainOutlook } from './fixture-rain-outlook';
import { OpenMeteoRainOutlook, parseRainSums } from './open-meteo-rain-outlook';

describe('rain outlook', () => {
  it('rains 5 mm on the Washington asOf and 0 mm otherwise', async () => {
    const rain = new FixtureRainOutlook();
    const wet = await rain.daily(WASHINGTON_PLACE.latitude, WASHINGTON_PLACE.longitude, '2026-10-03');
    expect(wet?.['2026-10-03']).toBe(5);
    expect(wet?.['2026-10-02']).toBe(0);
    expect(wet?.['2026-10-04']).toBe(0);
    const dry = await rain.daily(MAIN_STREET_PLACES[1]!.latitude, MAIN_STREET_PLACES[1]!.longitude, '2026-10-03');
    expect(dry?.['2026-10-03']).toBe(0);
  });

  it('reads rain_sum and returns null when the forecast fails', async () => {
    expect(
      parseRainSums({ daily: { time: ['2026-10-03', '2026-10-04'], rain_sum: [2.5, 0] } }),
    ).toEqual({ '2026-10-03': 2.5, '2026-10-04': 0 });
    const failed = new OpenMeteoRainOutlook(async () => {
      throw new Error('timeout');
    });
    await expect(failed.daily(1, 2, '2026-10-03')).resolves.toBeNull();
    const ok = new OpenMeteoRainOutlook(async (input) => {
      expect(String(input)).toContain('daily=rain_sum');
      expect(String(input)).not.toContain('precipitation_sum');
      return {
        ok: true,
        json: async () => ({ daily: { time: ['2026-10-03'], rain_sum: [5] } }),
      } as Response;
    });
    await expect(ok.daily(1, 2, '2026-10-03')).resolves.toEqual({ '2026-10-03': 5 });
  });
});
