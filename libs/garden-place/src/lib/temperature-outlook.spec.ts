import { describe, expect, it, vi } from 'vitest';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';
import {
  FixtureTemperatureOutlook,
  OpenMeteoTemperatureOutlook,
  parseDayTemperatures,
  temperatureOutlookFor,
} from './temperature-outlook';

const reply = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

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

  it('asks Open-Meteo for four days from asOf, and caches the answer for an hour', async () => {
    let now = 0;
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('daily')).toBe('temperature_2m_min,temperature_2m_max');
      expect(url.searchParams.get('start_date')).toBe('2026-11-17');
      expect(url.searchParams.get('end_date')).toBe('2026-11-20');
      return reply({
        daily: { time: ['2026-11-17'], temperature_2m_min: [0], temperature_2m_max: [9] },
      });
    });
    const outlook = new OpenMeteoTemperatureOutlook(fetchFn, () => now);
    const first = await outlook.daily(38.9, -77, '2026-11-17');
    expect(first).toEqual({ '2026-11-17': { minC: 0, maxC: 9 } });
    now = 30 * 60 * 1000;
    await outlook.daily(38.9, -77, '2026-11-17');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now = 61 * 60 * 1000;
    await outlook.daily(38.9, -77, '2026-11-17');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns null when the forecast fails, without caching the failure', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: false });
    const outlook = new OpenMeteoTemperatureOutlook(fetchFn as typeof fetch);
    await expect(outlook.daily(1, 2, '2026-11-17')).resolves.toBeNull();
    await expect(outlook.daily(1, 2, '2026-11-17')).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
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
