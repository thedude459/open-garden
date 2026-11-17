import type { FrostTolerance, WeatherAlertDto } from '@open-garden/shared-types';

/** A plant in a bed, with what decides whether weather can hurt it. */
export interface AlertPlanting {
  name: string;
  bedName: string | null;
  frostTolerance: FrostTolerance | null;
  /** The top of the crop's growing range, °C. */
  growMaxC: number | null;
}

/**
 * The forecast low at or below which a crop is at risk. A tender crop is hurt
 * by any frost, and a clear night can frost the ground with the air at 1 °C; a
 * half-hardy crop takes a light frost but not a hard one. Hardy crops are not
 * warned about.
 */
const FROST_AT_C: Record<FrostTolerance, number | null> = {
  tender: 1,
  'half-hardy': -2,
  hardy: null,
};

/**
 * Frost and heat alerts for one property: for each, the soonest day in the
 * forecast that puts a plant at risk, and every plant at risk that day.
 * Advice only; nothing is blocked.
 */
export function weatherAlerts(
  plantings: AlertPlanting[],
  forecast: Record<string, { minC: number; maxC: number }> | null,
  asOf: string,
): WeatherAlertDto[] {
  if (!forecast) return [];
  const days = Object.keys(forecast)
    .filter((day) => day >= asOf)
    .sort();
  const alerts: WeatherAlertDto[] = [];
  for (const day of days) {
    const { minC } = forecast[day]!;
    const atRisk = plantings.filter((p) => {
      const limit = p.frostTolerance ? FROST_AT_C[p.frostTolerance] : null;
      return limit != null && minC <= limit;
    });
    if (atRisk.length) {
      alerts.push({ kind: 'frost', date: day, tempC: minC, plantings: unique(atRisk) });
      break;
    }
  }
  for (const day of days) {
    const { maxC } = forecast[day]!;
    const atRisk = plantings.filter((p) => p.growMaxC != null && maxC > p.growMaxC);
    if (atRisk.length) {
      alerts.push({ kind: 'heat', date: day, tempC: maxC, plantings: unique(atRisk) });
      break;
    }
  }
  return alerts;
}

/** Each plant once per bed, in the order given. */
function unique(plantings: AlertPlanting[]): WeatherAlertDto['plantings'] {
  const seen = new Set<string>();
  const out: WeatherAlertDto['plantings'] = [];
  for (const { name, bedName } of plantings) {
    const key = `${name}\u0000${bedName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, bedName });
  }
  return out;
}
