import { isWashingtonPoint } from './fixtures';
import { shiftIsoDate } from './dates';
import type { DayWater, WaterOutlook } from './ports';

/** Days back the water balance reads, so a deficit can build since the last watering. */
export const WATER_PAST_DAYS = 30;
/** Days ahead, from today: when watering will be due this week. */
export const WATER_FORECAST_DAYS = 7;

/** Reads Open-Meteo's `et0_fao_evapotranspiration` and `rain_sum` by day. */
export function parseDayWater(body: {
  daily?: {
    time?: string[];
    et0_fao_evapotranspiration?: Array<number | null>;
    rain_sum?: Array<number | null>;
  };
}): Record<string, DayWater> | null {
  const time = body.daily?.time;
  const et0 = body.daily?.et0_fao_evapotranspiration;
  const rain = body.daily?.rain_sum;
  if (!time || !et0 || !rain || time.length === 0) return null;
  if (time.length !== et0.length || time.length !== rain.length) return null;
  const daily: Record<string, DayWater> = {};
  for (let i = 0; i < time.length; i++) {
    const day = time[i];
    const et0Mm = et0[i];
    const rainMm = rain[i];
    if (!day || et0Mm == null || rainMm == null || Number.isNaN(et0Mm) || Number.isNaN(rainMm)) {
      continue;
    }
    daily[day] = { et0Mm, rainMm };
  }
  return daily;
}

/** Cached for this long, so the reminders page, Today, and the daily send share one request. */
const CACHE_MS = 60 * 60 * 1000;

/**
 * Open-Meteo's daily reference evapotranspiration (FAO-56 Penman-Monteith)
 * and rain, from 30 days back to 6 days ahead, in one request.
 */
export class OpenMeteoWaterOutlook implements WaterOutlook {
  // ponytail: an unbounded in-memory map, one entry per property and day;
  // fine for a household install. Bound it (LRU) if one API serves many.
  private readonly cache = new Map<string, { at: number; value: Record<string, DayWater> }>();

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async daily(
    latitude: number,
    longitude: number,
    asOf: string,
  ): Promise<Record<string, DayWater> | null> {
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)},${asOf}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_MS) return hit.value;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('daily', 'et0_fao_evapotranspiration,rain_sum');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', shiftIsoDate(asOf, -WATER_PAST_DAYS));
    url.searchParams.set('end_date', shiftIsoDate(asOf, WATER_FORECAST_DAYS - 1));
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;
      const value = parseDayWater((await response.json()) as Parameters<typeof parseDayWater>[0]);
      if (value) this.cache.set(key, { at: this.now(), value });
      return value;
    } catch {
      return null;
    }
  }
}

/**
 * For tests and offline development: 4 mm of evapotranspiration every day
 * and no rain, except 5 mm today at the Washington point.
 */
export class FixtureWaterOutlook implements WaterOutlook {
  async daily(latitude: number, longitude: number, asOf: string) {
    const rainyToday = isWashingtonPoint(latitude, longitude);
    const days: Record<string, DayWater> = {};
    for (let i = -WATER_PAST_DAYS; i < WATER_FORECAST_DAYS; i++) {
      days[shiftIsoDate(asOf, i)] = { et0Mm: 4, rainMm: rainyToday && i === 0 ? 5 : 0 };
    }
    return days;
  }
}

/** Open-Meteo when `PLACE_PROVIDER=live`, the fixture otherwise (tests, offline development). */
export function waterOutlookFor(env: NodeJS.ProcessEnv = process.env): WaterOutlook {
  return env['PLACE_PROVIDER'] === 'live' ? new OpenMeteoWaterOutlook() : new FixtureWaterOutlook();
}
