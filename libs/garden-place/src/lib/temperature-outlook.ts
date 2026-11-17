import { isWashingtonPoint } from './fixtures';
import { shiftIsoDate } from './dates';
import type { DayTemperatures, TemperatureOutlook } from './ports';

/** Days of forecast a weather alert looks at: today and the next three. */
export const ALERT_FORECAST_DAYS = 4;

/** Reads Open-Meteo's `temperature_2m_min` and `temperature_2m_max` by day. */
export function parseDayTemperatures(body: {
  daily?: {
    time?: string[];
    temperature_2m_min?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
  };
}): Record<string, DayTemperatures> | null {
  const time = body.daily?.time;
  const lows = body.daily?.temperature_2m_min;
  const highs = body.daily?.temperature_2m_max;
  if (!time || !lows || !highs || time.length === 0) return null;
  if (time.length !== lows.length || time.length !== highs.length) return null;
  const daily: Record<string, DayTemperatures> = {};
  for (let i = 0; i < time.length; i++) {
    const day = time[i];
    const minC = lows[i];
    const maxC = highs[i];
    if (!day || minC == null || maxC == null || Number.isNaN(minC) || Number.isNaN(maxC)) continue;
    daily[day] = { minC, maxC };
  }
  return daily;
}

/** Cached forecasts kept for this long, so Today and the daily reminders share one request. */
const CACHE_MS = 60 * 60 * 1000;

export class OpenMeteoTemperatureOutlook implements TemperatureOutlook {
  // ponytail: an unbounded in-memory map, one entry per property and day;
  // fine for a household install. Bound it (LRU) if one API serves many.
  private readonly cache = new Map<
    string,
    { at: number; value: Record<string, DayTemperatures> }
  >();

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async daily(
    latitude: number,
    longitude: number,
    asOf: string,
  ): Promise<Record<string, DayTemperatures> | null> {
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)},${asOf}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_MS) return hit.value;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', asOf);
    url.searchParams.set('end_date', shiftIsoDate(asOf, ALERT_FORECAST_DAYS - 1));
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;
      const value = parseDayTemperatures(
        (await response.json()) as Parameters<typeof parseDayTemperatures>[0],
      );
      if (value) this.cache.set(key, { at: this.now(), value });
      return value;
    } catch {
      return null;
    }
  }
}

/**
 * For tests and offline development: frost tomorrow at the Washington point
 * (low −2 °C), a mild week everywhere else.
 */
export class FixtureTemperatureOutlook implements TemperatureOutlook {
  async daily(latitude: number, longitude: number, asOf: string) {
    const frost = isWashingtonPoint(latitude, longitude);
    const days: Record<string, DayTemperatures> = {};
    for (let i = 0; i < ALERT_FORECAST_DAYS; i++) {
      days[shiftIsoDate(asOf, i)] =
        frost && i === 1 ? { minC: -2, maxC: 8 } : { minC: 10, maxC: 20 };
    }
    return days;
  }
}

/** Open-Meteo when `PLACE_PROVIDER=live`, the fixture otherwise (tests, offline development). */
export function temperatureOutlookFor(env: NodeJS.ProcessEnv = process.env): TemperatureOutlook {
  return env['PLACE_PROVIDER'] === 'live'
    ? new OpenMeteoTemperatureOutlook()
    : new FixtureTemperatureOutlook();
}
