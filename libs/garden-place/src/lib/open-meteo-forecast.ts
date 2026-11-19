import { shiftIsoDate } from './dates';

/** Days back the water balance reads, so a deficit can build since the last watering. */
export const WATER_PAST_DAYS = 30;
/** Days ahead, from today: when watering will be due this week. */
export const WATER_FORECAST_DAYS = 7;

/** Open-Meteo's daily series, as the water and temperature outlooks read them. */
export interface ForecastBody {
  daily?: {
    time?: string[];
    et0_fao_evapotranspiration?: Array<number | null>;
    rain_sum?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
  };
}

/** Cached for this long, so the reminders page, Today, and the daily send share one request. */
const CACHE_MS = 60 * 60 * 1000;

/**
 * One Open-Meteo request per property and day: evapotranspiration, rain, and
 * daily lows and highs, from 30 days back to 6 days ahead. The water outlook
 * and the frost and heat alerts both read it.
 */
export class OpenMeteoForecast {
  // ponytail: an unbounded in-memory map, one entry per property and day;
  // fine for a household install. Bound it (LRU) if one API serves many.
  private readonly cache = new Map<string, { at: number; value: Promise<ForecastBody | null> }>();

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** The forecast, or null when Open-Meteo cannot be read (a failure is not cached). */
  daily(latitude: number, longitude: number, asOf: string): Promise<ForecastBody | null> {
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)},${asOf}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_MS) return hit.value;
    // The promise is cached, so the outlooks asking at once share one request.
    const value = this.fetch(latitude, longitude, asOf);
    this.cache.set(key, { at: this.now(), value });
    void value.then((body) => {
      if (!body && this.cache.get(key)?.value === value) this.cache.delete(key);
    });
    return value;
  }

  private async fetch(latitude: number, longitude: number, asOf: string) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set(
      'daily',
      'et0_fao_evapotranspiration,rain_sum,temperature_2m_min,temperature_2m_max',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', shiftIsoDate(asOf, -WATER_PAST_DAYS));
    url.searchParams.set('end_date', shiftIsoDate(asOf, WATER_FORECAST_DAYS - 1));
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;
      return (await response.json()) as ForecastBody;
    } catch {
      return null;
    }
  }
}

/** The live forecast both outlooks share, so a property costs one request an hour. */
export const liveForecast = new OpenMeteoForecast();
