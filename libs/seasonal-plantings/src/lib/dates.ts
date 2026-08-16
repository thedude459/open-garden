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
