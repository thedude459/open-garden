import { describe, expect, it } from 'vitest';
import { OpenMeteoForecast } from './open-meteo-forecast';
import { OpenMeteoTemperatureOutlook } from './temperature-outlook';
import { OpenMeteoWaterOutlook } from './water-outlook';

const reply = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const body = {
  daily: {
    time: ['2026-05-31', '2026-06-30', '2026-07-03', '2026-07-06'],
    et0_fao_evapotranspiration: [4.2, 3, 3, 3],
    rain_sum: [1.5, 0, 0, 0],
    temperature_2m_min: [10, -1, 12, 14],
    temperature_2m_max: [20, 9, 22, 24],
  },
};

describe('Open-Meteo forecast', () => {
  it('asks for water and temperatures, 30 days back to 6 ahead, in one request an hour', async () => {
    const urls: string[] = [];
    let now = 0;
    const forecast = new OpenMeteoForecast(
      async (input) => {
        urls.push(String(input));
        return reply(body);
      },
      () => now,
    );
    const water = new OpenMeteoWaterOutlook(forecast);
    const temperatures = new OpenMeteoTemperatureOutlook(forecast);
    const [wet, warm] = await Promise.all([
      water.daily(38.9, -77, '2026-06-30'),
      temperatures.daily(38.9, -77, '2026-06-30'),
    ]);
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]!);
    expect(url.searchParams.get('daily')).toBe(
      'et0_fao_evapotranspiration,rain_sum,temperature_2m_min,temperature_2m_max',
    );
    expect(url.searchParams.get('start_date')).toBe('2026-05-31');
    expect(url.searchParams.get('end_date')).toBe('2026-07-06');
    expect(Object.keys(wet!)).toHaveLength(4);
    // The alerts look at today and the next three days only.
    expect(warm).toEqual({
      '2026-06-30': { minC: -1, maxC: 9 },
      '2026-07-03': { minC: 12, maxC: 22 },
    });
    now = 30 * 60 * 1000;
    await water.daily(38.9, -77, '2026-06-30');
    expect(urls).toHaveLength(1);
    now = 61 * 60 * 1000;
    await temperatures.daily(38.9, -77, '2026-06-30');
    expect(urls).toHaveLength(2);
  });

  it('answers null, and caches nothing, when the weather cannot be read', async () => {
    let calls = 0;
    const failing = new OpenMeteoForecast(async () => {
      calls++;
      throw new Error('timeout');
    });
    await expect(failing.daily(1, 2, '2026-06-01')).resolves.toBeNull();
    await expect(new OpenMeteoWaterOutlook(failing).daily(1, 2, '2026-06-01')).resolves.toBeNull();
    await expect(
      new OpenMeteoTemperatureOutlook(failing).daily(1, 2, '2026-06-01'),
    ).resolves.toBeNull();
    expect(calls).toBe(3);
    const refused = new OpenMeteoForecast(async () => ({ ok: false }) as Response);
    await expect(refused.daily(1, 2, '2026-06-01')).resolves.toBeNull();
  });
});
