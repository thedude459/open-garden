import { isWashingtonPoint } from './fixtures';
import { shiftIsoDate } from './dates';
import { OpenMeteoForecast, liveForecast, type ForecastBody } from './open-meteo-forecast';
import type { DayTemperatures, TemperatureOutlook } from './ports';

/** Days of forecast a weather alert looks at: today and the next three. */
export const ALERT_FORECAST_DAYS = 4;

/** Reads Open-Meteo's `temperature_2m_min` and `temperature_2m_max` by day. */
export function parseDayTemperatures(body: ForecastBody): Record<string, DayTemperatures> | null {
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

/** Lows and highs for today and the next three days, from the shared forecast. */
export class OpenMeteoTemperatureOutlook implements TemperatureOutlook {
  constructor(private readonly forecast: OpenMeteoForecast = liveForecast) {}

  async daily(latitude: number, longitude: number, asOf: string) {
    const body = await this.forecast.daily(latitude, longitude, asOf);
    const all = body && parseDayTemperatures(body);
    if (!all) return null;
    const last = shiftIsoDate(asOf, ALERT_FORECAST_DAYS - 1);
    return Object.fromEntries(Object.entries(all).filter(([day]) => day >= asOf && day <= last));
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
