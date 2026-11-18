import { isWashingtonPoint } from './fixtures';
import { shiftIsoDate } from './dates';
import {
  OpenMeteoForecast,
  WATER_FORECAST_DAYS,
  WATER_PAST_DAYS,
  liveForecast,
  type ForecastBody,
} from './open-meteo-forecast';
import type { DayWater, WaterOutlook } from './ports';

export { WATER_FORECAST_DAYS, WATER_PAST_DAYS };

/** Reads Open-Meteo's `et0_fao_evapotranspiration` and `rain_sum` by day. */
export function parseDayWater(body: ForecastBody): Record<string, DayWater> | null {
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

/** Evapotranspiration and rain, from 30 days back to 6 days ahead, from the shared forecast. */
export class OpenMeteoWaterOutlook implements WaterOutlook {
  constructor(private readonly forecast: OpenMeteoForecast = liveForecast) {}

  async daily(latitude: number, longitude: number, asOf: string) {
    const body = await this.forecast.daily(latitude, longitude, asOf);
    return body && parseDayWater(body);
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
