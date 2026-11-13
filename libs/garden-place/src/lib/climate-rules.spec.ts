import { describe, expect, it } from 'vitest';
import {
  FixtureClimateLookup,
  FallbackClimateLookup,
  LiveClimateLookup,
  NasaPowerClimateLookup,
  climateFromDailyMinimums,
  climateLookupFor,
  keepFrostPair,
  zoneFromMinimum,
} from './climate';
import { HONOLULU_PLACE, MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';

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

  it('south of the equator keeps a spring-then-autumn pair that wraps the year end', () => {
    const spring = { month: 9, day: 15 };
    const autumn = { month: 5, day: 10 };
    expect(keepFrostPair(spring, autumn, -34)).toEqual({ last: spring, first: autumn });
    expect(keepFrostPair(spring, autumn, 34)).toEqual({ last: null, first: null });
    expect(keepFrostPair(autumn, spring, -34)).toEqual({ last: null, first: null });
  });

  it('gives the frost-free fixture warm months and no frost dates', async () => {
    const facts = await new FixtureClimateLookup().lookup(HONOLULU_PLACE);
    expect(facts).toMatchObject({ hardinessZone: 12, lastFrost: null, firstFrost: null });
    expect(facts.monthlyMeanC).toHaveLength(12);
  });

  it('fills Washington and leaves another fixture coordinate empty', async () => {
    const climate = new FixtureClimateLookup();
    await expect(climate.lookup(WASHINGTON_PLACE)).resolves.toEqual({
      hardinessZone: 8,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
      monthlyMeanC: [2, 4, 9, 14, 20, 25, 27, 26, 22, 15, 10, 4],
      frostRisk: { lateLastFrost: { month: 5, day: 2 }, earlyFirstFrost: { month: 10, day: 5 } },
    });
    await expect(climate.lookup(MAIN_STREET_PLACES[0]!)).resolves.toEqual({
      hardinessZone: null,
      lastFrost: null,
      firstFrost: null,
      monthlyMeanC: null,
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
      monthlyMeanC: null,
      frostRisk: { lateLastFrost: { month: 4, day: 20 }, earlyFirstFrost: { month: 10, day: 20 } },
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
      monthlyMeanC: null,
      frostRisk: null,
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
      monthlyMeanC: null,
    });
    expect(climateFromDailyMinimums(data.time, data.minimums, 45)).toEqual({
      hardinessZone: 9,
      lastFrost: { month: 3, day: 31 },
      firstFrost: null,
      monthlyMeanC: null,
      frostRisk: null,
    });
  });
});

describe('1-in-10 frost dates', () => {
  it('puts 1 spring in 10 after the late date and 1 autumn in 10 before the early one', () => {
    // Ten years; last frost on 1–10 April and first frost on 11–20 October.
    const data = daily(2010, 2019, (year, month, day) =>
      (month === 4 && day === year - 2009) || (month === 10 && day === year - 1999) ? -1 : 8,
    );
    const facts = climateFromDailyMinimums(data.time, data.minimums, 45);
    expect(facts.lastFrost).toEqual({ month: 4, day: 5 });
    expect(facts.frostRisk).toEqual({
      lateLastFrost: { month: 4, day: 9 },
      earlyFirstFrost: { month: 10, day: 11 },
    });
  });

  it('keeps southern risk dates through the live lookup', async () => {
    const data = daily(1996, 2025, (_y, month, day) =>
      (month === 9 && day === 15) || (month === 5 && day === 10) ? -1 : 6,
    );
    const fetchFn = (async () =>
      json({
        daily: { time: data.time, temperature_2m_min: data.minimums },
      })) as unknown as typeof fetch;
    const facts = await new LiveClimateLookup(
      fetchFn,
      () => new Date('2026-06-01T00:00:00Z'),
    ).lookup({
      ...WASHINGTON_PLACE,
      latitude: -34,
    });
    expect(facts.frostRisk).toEqual({
      lateLastFrost: { month: 9, day: 15 },
      earlyFirstFrost: { month: 5, day: 10 },
    });
  });
});

describe('monthly mean temperatures', () => {
  it('averages each month over the years, and needs every month', () => {
    const data = daily(2021, 2022, (_y, month) => month);
    const means = data.time.map((day) => Number(day.slice(5, 7)) + 0.5);
    const facts = climateFromDailyMinimums(data.time, data.minimums, 10, means);
    expect(facts.monthlyMeanC).toEqual([
      1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5,
    ]);
    const noJuly = means.map((t, i) => (data.time[i]!.slice(5, 7) === '07' ? null : t));
    expect(climateFromDailyMinimums(data.time, data.minimums, 10, noJuly).monthlyMeanC).toBeNull();
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
      return json({
        daily: {
          time: data.time,
          temperature_2m_min: data.minimums,
          temperature_2m_mean: data.minimums.map((t) => t + 5),
        },
      });
    }) as typeof fetch;
    const facts = await new LiveClimateLookup(fetchFn, now).lookup(WASHINGTON_PLACE);
    expect(asked?.hostname).toBe('archive-api.open-meteo.com');
    expect(asked?.searchParams.get('start_date')).toBe('1996-01-01');
    expect(asked?.searchParams.get('end_date')).toBe('2025-12-31');
    expect(asked?.searchParams.get('latitude')).toBe(String(WASHINGTON_PLACE.latitude));
    expect(asked?.searchParams.get('daily')).toBe('temperature_2m_min,temperature_2m_mean');
    expect(facts).toEqual({
      hardinessZone: 10,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
      monthlyMeanC: [11, 11, 11, 10.8, 11, 11, 11, 11, 11, 10.8, 11, 11],
      frostRisk: { lateLastFrost: { month: 4, day: 15 }, earlyFirstFrost: { month: 10, day: 20 } },
    });
  });

  it('keeps southern frost dates', async () => {
    const data = daily(1996, 2025, (_y, month, day) =>
      (month === 9 && day === 15) || (month === 5 && day === 10) ? -1 : 6,
    );
    const fetchFn = (async () =>
      json({
        daily: { time: data.time, temperature_2m_min: data.minimums },
      })) as unknown as typeof fetch;
    const facts = await new LiveClimateLookup(fetchFn, now).lookup({
      ...WASHINGTON_PLACE,
      latitude: -34,
    });
    expect(facts).toMatchObject({
      lastFrost: { month: 9, day: 15 },
      firstFrost: { month: 5, day: 10 },
    });
  });

  it('leaves the climate unset when the service fails or answers oddly', async () => {
    const none = { hardinessZone: null, lastFrost: null, firstFrost: null, monthlyMeanC: null };
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

describe('NASA POWER and the fallback', () => {
  const now = () => new Date('2026-06-01T00:00:00Z');
  const data = daily(1996, 2025, (_y, month, day) =>
    (month === 4 && day === 15) || (month === 10 && day === 20) ? -1 : 6,
  );
  /** NASA POWER's shape: readings keyed YYYYMMDD, -999 where missing. */
  const power = (fill = false) => {
    const min: Record<string, number> = {};
    const mean: Record<string, number> = {};
    data.time.forEach((day, i) => {
      const key = day.replaceAll('-', '');
      min[key] = data.minimums[i]!;
      mean[key] = fill && day.startsWith('2025-07') ? -999 : data.minimums[i]! + 5;
    });
    return { properties: { parameter: { T2M_MIN: min, T2M: mean } } };
  };

  it('reads NASA POWER for the last 30 full years', async () => {
    let asked: URL | undefined;
    const fetchFn = (async (input: RequestInfo | URL) => {
      asked = new URL(String(input));
      return json(power());
    }) as typeof fetch;
    const facts = await new NasaPowerClimateLookup(fetchFn, now).lookup(WASHINGTON_PLACE);
    expect(asked?.hostname).toBe('power.larc.nasa.gov');
    expect(asked?.searchParams.get('start')).toBe('19960101');
    expect(asked?.searchParams.get('end')).toBe('20251231');
    expect(asked?.searchParams.get('parameters')).toBe('T2M_MIN,T2M');
    expect(facts).toMatchObject({
      hardinessZone: 10,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
    });
    expect(facts.monthlyMeanC).toHaveLength(12);
  });

  it('treats NASA POWER’s -999 as missing, and a failure as nothing known', async () => {
    const filled = (async () => json(power(true))) as unknown as typeof fetch;
    const facts = await new NasaPowerClimateLookup(filled, now).lookup(WASHINGTON_PLACE);
    expect(facts.monthlyMeanC?.[6]).toBe(11);
    const down = (async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    await expect(new NasaPowerClimateLookup(down, now).lookup(WASHINGTON_PLACE)).resolves.toEqual({
      hardinessZone: null,
      lastFrost: null,
      firstFrost: null,
      monthlyMeanC: null,
    });
  });

  it('falls back only when the first source knows nothing', async () => {
    const empty = { lookup: async () => new FixtureClimateLookup().lookup(MAIN_STREET_PLACES[0]!) };
    const known = new FixtureClimateLookup();
    const backup = {
      lookup: async () => ({ ...(await known.lookup(WASHINGTON_PLACE)), hardinessZone: 5 }),
    };
    expect(
      (await new FallbackClimateLookup(empty, backup).lookup(WASHINGTON_PLACE)).hardinessZone,
    ).toBe(5);
    expect(
      (await new FallbackClimateLookup(known, backup).lookup(WASHINGTON_PLACE)).hardinessZone,
    ).toBe(8);
  });

  it('picks the source from the environment', () => {
    expect(climateLookupFor({})).toBeInstanceOf(FixtureClimateLookup);
    expect(climateLookupFor({ PLACE_PROVIDER: 'live' })).toBeInstanceOf(FallbackClimateLookup);
    expect(
      climateLookupFor({ PLACE_PROVIDER: 'live', CLIMATE_SOURCE: 'nasa-power' }),
    ).toBeInstanceOf(NasaPowerClimateLookup);
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
