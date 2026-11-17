import type { CropCoefficientsDto } from '@open-garden/shared-types';
import { addIsoDateDays, diffIsoDateDays } from './dates';

/** A day's reference evapotranspiration (ET₀) and rain, in millimetres. */
export interface DayWater {
  et0Mm: number;
  rainMm: number;
}

/**
 * The deficit, in millimetres, at which watering is due: the water a garden
 * loam holds within a vegetable's reach that it can take without stress.
 * FAO-56 calls this readily available water (RAW = p × TAW): about 140 mm per
 * metre of loam, roots 0.3–0.5 m deep, and p ≈ 0.4 for vegetables give 20–30 mm.
 * ponytail: one figure for every crop and soil; per-crop root depth and the
 * bed's soil texture (from a soil test or soil by location) are the upgrade.
 */
export const WATER_DUE_MM = 25;

/**
 * FAO-56 counts rain below a fifth of the day's ET₀ as lost to the surface:
 * it wets the top and evaporates before it reaches the roots.
 */
const INEFFECTIVE_RAIN_SHARE = 0.2;

const SUN_FACTOR = { full: 1, part: 0.8, shade: 0.6 } as const;
const MULCH_FACTOR = { none: 1, plastic: 0.85 } as const;
/** Organic mulches (wood chips, straw, leaves, compost, paper). */
const ORGANIC_MULCH_FACTOR = 0.9;

/**
 * How a bed changes what its plants use. Shade cuts the sun that drives
 * evaporation; mulch cuts evaporation from the soil (plastic more than
 * organic). ponytail: fixed factors, not FAO-56's dual coefficients
 * (separate soil evaporation); fine for advice, and the upgrade if
 * reminders run early or late in practice.
 */
export function bedWaterFactor(sun: string | null | undefined, mulch: string | null | undefined) {
  const sunFactor = sun === 'part' || sun === 'shade' ? SUN_FACTOR[sun] : SUN_FACTOR.full;
  const mulchFactor =
    !mulch || mulch === 'none'
      ? MULCH_FACTOR.none
      : mulch === 'plastic'
        ? MULCH_FACTOR.plastic
        : ORGANIC_MULCH_FACTOR;
  return sunFactor * mulchFactor;
}

/**
 * The crop coefficient `day` days after planting, FAO-56 Eq. 66: `initial`
 * through the initial stage, rising in a straight line to `mid` across
 * development, `mid` through mid-season, then falling to `end` across the
 * late stage. A crop without stage lengths, or a perennial past its first
 * season's start, stands at `mid`.
 * ponytail: perennials get no dormant season; reminders follow the weather,
 * and a dormant tree uses little ET₀ in winter anyway.
 */
export function kcOnDay(kc: CropCoefficientsDto, day: number, annual = true): number {
  const stages = kc.stageDays;
  if (!stages || !annual) return kc.mid;
  const devStart = stages.initial;
  const midStart = devStart + stages.development;
  const lateStart = midStart + stages.mid;
  const end = lateStart + stages.late;
  if (day < devStart) return kc.initial;
  if (day < midStart)
    return kc.initial + ((day - devStart) / stages.development) * (kc.mid - kc.initial);
  if (day < lateStart) return kc.mid;
  if (day < end) return kc.mid + ((day - lateStart) / stages.late) * (kc.end - kc.mid);
  return kc.end;
}

export interface WaterBalanceInput {
  plantedOn: string;
  /** The last day the planting was watered, from its care events. */
  lastWateredOn: string | null;
  kc: CropCoefficientsDto;
  annual: boolean;
  /** `bedWaterFactor` of its bed. */
  factor: number;
}

export type WaterDue =
  /** Watering is due on this day (on or before `asOf` means overdue or today). */
  | { dueOn: string; deficitMm: number }
  /** Not due within the forecast. */
  | 'not-due'
  /** The weather does not cover the days since the last watering. */
  | null;

/**
 * FAO-56's daily root-zone water balance (Eq. 85), simplified: from the last
 * watering, when the soil is full, each day the crop uses ET₀ × Kc × the bed's
 * factor and rain that counts (above a fifth of ET₀) puts water back; the
 * deficit never goes below zero, since more drains away. Watering is due on
 * the first day the deficit reaches `WATER_DUE_MM`, looking up to the end of
 * the forecast.
 */
export function waterDue(
  input: WaterBalanceInput,
  weather: Record<string, DayWater>,
  asOf: string,
): WaterDue {
  const days = Object.keys(weather).sort();
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return null;
  let from =
    input.lastWateredOn && input.lastWateredOn > input.plantedOn
      ? input.lastWateredOn
      : input.plantedOn;
  // Further back than the weather goes: count from its first day.
  if (from < first) from = addIsoDateDays(first, -1);
  let deficit = 0;
  for (let day = addIsoDateDays(from, 1); day <= last; day = addIsoDateDays(day, 1)) {
    const w = weather[day];
    if (!w) {
      if (day <= asOf) return null;
      break;
    }
    const crop = w.et0Mm * kcOnDay(input.kc, diffIsoDateDays(input.plantedOn, day), input.annual);
    const rain = w.rainMm >= INEFFECTIVE_RAIN_SHARE * w.et0Mm ? w.rainMm : 0;
    deficit = Math.max(0, deficit + crop * input.factor - rain);
    if (deficit >= WATER_DUE_MM) return { dueOn: day, deficitMm: Math.round(deficit) };
  }
  return 'not-due';
}
