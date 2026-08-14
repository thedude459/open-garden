import type { MonthDayDto } from '@open-garden/shared-types';
import { domainError } from './domain-error';

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validateMonthDay(value: MonthDayDto, label: string): void {
  const max = DAYS_IN_MONTH[value.month];
  if (!max || value.day < 1 || value.day > max) {
    throw domainError('VALIDATION_ERROR', `${label} is not a valid calendar day`);
  }
}

export function frostEarlier(a: MonthDayDto, b: MonthDayDto): boolean {
  return a.month < b.month || (a.month === b.month && a.day < b.day);
}

export function validateSiteProfile(input: {
  hardinessZone?: number | null;
  lastFrost?: MonthDayDto | null;
  firstFrost?: MonthDayDto | null;
}): void {
  if (input.hardinessZone != null && (input.hardinessZone < 1 || input.hardinessZone > 13)) {
    throw domainError('VALIDATION_ERROR', 'hardiness zone must be between 1 and 13');
  }
  if (input.lastFrost) validateMonthDay(input.lastFrost, 'last frost');
  if (input.firstFrost) validateMonthDay(input.firstFrost, 'first frost');
  if (input.lastFrost && input.firstFrost && !frostEarlier(input.lastFrost, input.firstFrost)) {
    throw domainError(
      'VALIDATION_ERROR',
      'last frost must be earlier in the calendar year than first frost',
    );
  }
}
