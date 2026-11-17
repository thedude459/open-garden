import { describe, expect, it } from 'vitest';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';
import { shiftIsoDate } from './dates';
import {
  FixtureWaterOutlook,
  OpenMeteoWaterOutlook,
  parseDayWater,
  waterOutlookFor,
} from './water-outlook';

const reply = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const day = { time: ['2026-06-01'], et0_fao_evapotranspiration: [4.2], rain_sum: [1.5] };

describe('water outlook', () => {
  it('reads each day’s evapotranspiration and rain, skipping gaps', () => {
    expect(
      parseDayWater({
        daily: {
          time: ['2026-06-01', '2026-06-02', '2026-06-03'],
          et0_fao_evapotranspiration: [4.2, null, 3],
          rain_sum: [0, 2, 6.5],
        },
      }),
    ).toEqual({
      '2026-06-01': { et0Mm: 4.2, rainMm: 0 },
      '2026-06-03': { et0Mm: 3, rainMm: 6.5 },
    });
    expect(parseDayWater({ daily: { time: [] } })).toBeNull();
    expect(
      parseDayWater({
        daily: { time: ['a', 'b'], et0_fao_evapotranspiration: [1], rain_sum: [1, 2] },
      }),
    ).toBeNull();
  });

  it('asks for 30 days back to 6 ahead in one request, and keeps the answer an hour', async () => {
    const urls: string[] = [];
    let now = 0;
    const outlook = new OpenMeteoWaterOutlook(
      async (input) => {
        urls.push(String(input));
        return reply({ daily: day });
      },
      () => now,
    );
    expect(await outlook.daily(38.9, -77, '2026-06-30')).toEqual({
      '2026-06-01': { et0Mm: 4.2, rainMm: 1.5 },
    });
    expect(urls[0]).toContain('daily=et0_fao_evapotranspiration%2Crain_sum');
    expect(urls[0]).toContain('start_date=2026-05-31');
    expect(urls[0]).toContain('end_date=2026-07-06');
    await outlook.daily(38.9, -77, '2026-06-30');
    expect(urls).toHaveLength(1);
    now = 61 * 60 * 1000;
    await outlook.daily(38.9, -77, '2026-06-30');
    expect(urls).toHaveLength(2);
  });

  it('answers null, and caches nothing, when the weather cannot be read', async () => {
    let calls = 0;
    const failing = new OpenMeteoWaterOutlook(async () => {
      calls++;
      throw new Error('timeout');
    });
    await expect(failing.daily(1, 2, '2026-06-01')).resolves.toBeNull();
    await failing.daily(1, 2, '2026-06-01');
    expect(calls).toBe(2);
    const refused = new OpenMeteoWaterOutlook(async () => ({ ok: false }) as Response);
    await expect(refused.daily(1, 2, '2026-06-01')).resolves.toBeNull();
  });

  it('fixture: 4 mm a day and no rain, but 5 mm today at Washington', async () => {
    const fixture = new FixtureWaterOutlook();
    const asOf = '2026-06-30';
    const wet = await fixture.daily(WASHINGTON_PLACE.latitude, WASHINGTON_PLACE.longitude, asOf);
    expect(Object.keys(wet)).toHaveLength(37);
    expect(wet[asOf]).toEqual({ et0Mm: 4, rainMm: 5 });
    expect(wet[shiftIsoDate(asOf, -30)]).toEqual({ et0Mm: 4, rainMm: 0 });
    expect(wet[shiftIsoDate(asOf, 6)]).toEqual({ et0Mm: 4, rainMm: 0 });
    const dry = await fixture.daily(
      MAIN_STREET_PLACES[1]!.latitude,
      MAIN_STREET_PLACES[1]!.longitude,
      asOf,
    );
    expect(dry[asOf]).toEqual({ et0Mm: 4, rainMm: 0 });
  });

  it('uses Open-Meteo only when PLACE_PROVIDER is live', () => {
    expect(waterOutlookFor({ PLACE_PROVIDER: 'live' })).toBeInstanceOf(OpenMeteoWaterOutlook);
    expect(waterOutlookFor({})).toBeInstanceOf(FixtureWaterOutlook);
  });
});
