import { PLANTING_ERRORS } from './domain-error';

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

export function assertDatePair(
  plantedOn: string | null | undefined,
  harvestedOn: string | null | undefined,
): void {
  if (plantedOn != null && plantedOn !== undefined && !isIsoDate(plantedOn)) {
    throw PLANTING_ERRORS.dateInvalid();
  }
  if (harvestedOn != null && harvestedOn !== undefined && !isIsoDate(harvestedOn)) {
    throw PLANTING_ERRORS.dateInvalid();
  }
  if (plantedOn && harvestedOn && harvestedOn < plantedOn) {
    throw PLANTING_ERRORS.harvestBeforePlanted();
  }
}

/** Today in UTC, as the server sees it. */
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A planting's planned and planted dates (ADR 0040). `plantedOn` is only a
 * day it really happened, so a planted date more than a day after `today` is
 * taken as the plan: an older client, or an edit queued offline before
 * planned dates existed, still sends future sowings there. ponytail: "more
 * than a day" allows for the member's time zone being ahead of UTC.
 */
export function plannedOrPlanted(
  plannedOn: string | null | undefined,
  plantedOn: string | null | undefined,
  today: string,
): { plannedOn: string | null | undefined; plantedOn: string | null | undefined } {
  if (plannedOn != null && !isIsoDate(plannedOn)) throw PLANTING_ERRORS.dateInvalid();
  if (plantedOn && isIsoDate(plantedOn) && plantedOn > addDays(today, 1)) {
    return { plannedOn: plantedOn, plantedOn: null };
  }
  return { plannedOn, plantedOn };
}

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** An ISO date `days` later. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}
