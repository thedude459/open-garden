import { describe, expect, it } from 'vitest';
import {
  FixtureClimateLookup,
  LiveClimateLookup,
  climateFromDailyMinimums,
  keepFrostPair,
  zoneFromMinimum,
} from './climate';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';

describe('climate rules', () => {
  it('maps a mean annual extreme minimum to the USDA 10 °F bands', () => {
    expect(zoneFromMinimum(-17.7)).toBe(7); // 0.1 °F
    expect(zoneFromMinimum(-17.8)).toBe(6); // just under 0 °F
    expect(zoneFromMinimum(-15)).toBe(7); // 5 °F
    expect(zoneFromMinimum(-12.1)).toBe(8); // 10.2 °F
    expect(zoneFromMinimum(-70)).toBe(1);
    expect(zoneFromMinimum(30)).toBe(13);
  });

  it('keeps a spring-then-fall pair and drops a reversed or same-day pair', () => {
    expect(keepFrostPair({ month: 4, day: 15 }, { month: 10, day: 20 })).toEqual({
      last: { month: 4, day: 15 },
      first: { month: 10, day: 20 },
    });
    expect(keepFrostPair({ month: 10, day: 20 }, { month: 4, day: 15 })).toEqual({
      last: null,
      first: null,
    });
    expect(keepFrostPair({ month: 5, day: 1 }, { month: 5, day: 1 })).toEqual({
      last: null,
      first: null,
    });
    expect(keepFrostPair({ month: 4, day: 15 }, null)).toEqual({ last: null, first: null });
  });

  it('fills Washington and leaves another fixture coordinate empty', async () => {
    const climate = new FixtureClimateLookup();
    await expect(climate.lookup(WASHINGTON_PLACE)).resolves.toEqual({
      hardinessZone: 8,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
    });
    await expect(climate.lookup(MAIN_STREET_PLACES[0]!)).resolves.toEqual({
      hardinessZone: null,
      lastFrost: null,
      firstFrost: null,
    });
  });
});

describe('climate from daily minimums', () => {
  it('takes median frost dates and the zone from mean yearly minimums', () => {
    // Last spring frost on 1, 10, and 20 April; first fall frost 20 October.
    const springs = [1, 10, 20];
    const data = daily(2021, 2023, (year, month, day) => {
      if (month === 1 && day === 1) return -15;
      if (month === 4 && day === springs[year - 2021]) return -1;
      if (month === 10 && day === 20) return 0;
      return 10;
    });
    expect(climateFromDailyMinimums(data.time, data.minimums, 38.9)).toEqual({
      hardinessZone: 7,
      lastFrost: { month: 4, day: 10 },
      firstFrost: { month: 10, day: 20 },
    });
  });

  it('gives no frost dates where most years are frost-free', () => {
    const data = daily(2021, 2023, (year, month, day) =>
      year === 2021 && month === 2 && day === 1 ? -1 : 20,
    );
    expect(climateFromDailyMinimums(data.time, data.minimums, 10)).toEqual({
      hardinessZone: 12,
      lastFrost: null,
      firstFrost: null,
    });
  });

  it('runs southern years from midwinter in July', () => {
    // Last frost 15 September, first frost 10 May.
    const data = daily(2020, 2023, (_year, month, day) =>
      (month === 9 && day === 15) || (month === 5 && day === 10) ? -2 : 8,
    );
    expect(climateFromDailyMinimums(data.time, data.minimums, -34)).toMatchObject({
      lastFrost: { month: 9, day: 15 },
      firstFrost: { month: 5, day: 10 },
    });
  });

  it('skips years with gaps, and has nothing to say without a full year', () => {
    const data = daily(2024, 2024, (_y, month) => (month === 3 ? -3 : 5));
    expect(data.time).toContain('2024-02-29');
    const gappy = data.minimums.map((t, i) => (i % 2 ? null : t));
    expect(climateFromDailyMinimums(data.time, gappy, 45)).toEqual({
      hardinessZone: null,
      lastFrost: null,
      firstFrost: null,
    });
    expect(climateFromDailyMinimums(data.time, data.minimums, 45)).toEqual({
      hardinessZone: 9,
      lastFrost: { month: 3, day: 31 },
      firstFrost: null,
    });
  });
});

describe('live climate lookup', () => {
  const now = () => new Date('2026-06-01T00:00:00Z');

  it('asks Open-Meteo for the last 30 full years at the place', async () => {
    const data = daily(1996, 2025, (_y, month, day) =>
      (month === 4 && day === 15) || (month === 10 && day === 20) ? -1 : 6,
    );
    let asked: URL | undefined;
    const fetchFn = (async (input: RequestInfo | URL) => {
      asked = new URL(String(input));
      return json({ daily: { time: data.time, temperature_2m_min: data.minimums } });
    }) as typeof fetch;
    const facts = await new LiveClimateLookup(fetchFn, now).lookup(WASHINGTON_PLACE);
    expect(asked?.hostname).toBe('archive-api.open-meteo.com');
    expect(asked?.searchParams.get('start_date')).toBe('1996-01-01');
    expect(asked?.searchParams.get('end_date')).toBe('2025-12-31');
    expect(asked?.searchParams.get('latitude')).toBe(String(WASHINGTON_PLACE.latitude));
    expect(facts).toEqual({
      hardinessZone: 10,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
    });
  });

  it('leaves the climate unset when the service fails or answers oddly', async () => {
    const none = { hardinessZone: null, lastFrost: null, firstFrost: null };
    const answers: Array<() => Response> = [
      () => ({ ok: false }) as Response,
      () => json({ daily: { time: ['2025-01-01'], temperature_2m_min: [] } }),
      () => {
        throw new Error('offline');
      },
    ];
    for (const answer of answers) {
      const fetchFn = (async () => answer()) as unknown as typeof fetch;
      await expect(new LiveClimateLookup(fetchFn, now).lookup(WASHINGTON_PLACE)).resolves.toEqual(
        none,
      );
    }
  });
});

/** One reading per day from 1 January of `from` to 31 December of `to`. */
function daily(
  from: number,
  to: number,
  minimum: (year: number, month: number, day: number) => number,
): { time: string[]; minimums: number[] } {
  const time: string[] = [];
  const minimums: number[] = [];
  for (let t = Date.UTC(from, 0, 1); t <= Date.UTC(to, 11, 31); t += 86_400_000) {
    const date = new Date(t);
    time.push(date.toISOString().slice(0, 10));
    minimums.push(minimum(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
  }
  return { time, minimums };
}

function json(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}
