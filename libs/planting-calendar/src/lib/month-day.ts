import type { MonthDayDto } from '@open-garden/shared-types';

const MS_DAY = 86_400_000;
const REF_YEAR = 2024;

export interface DatedMonthDay extends MonthDayDto {
  year: number;
}

export function mdKey(md: MonthDayDto): number {
  return md.month * 100 + md.day;
}

export function addWeeks(md: MonthDayDto, weeks: number): DatedMonthDay {
  return fromUtc(Date.UTC(REF_YEAR, md.month - 1, md.day) + weeks * 7 * MS_DAY);
}

export function addDays(md: MonthDayDto, days: number): DatedMonthDay {
  return fromUtc(Date.UTC(REF_YEAR, md.month - 1, md.day) + days * MS_DAY);
}

function fromUtc(utc: number): DatedMonthDay {
  const d = new Date(utc);
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    year: d.getUTCFullYear(),
  };
}
