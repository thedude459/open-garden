import type { MonthDayDto } from '@open-garden/shared-types';

const MS_DAY = 86_400_000;

export interface DatedMonthDay extends MonthDayDto {
  year: number;
}

export function mdKey(md: MonthDayDto): number {
  return md.month * 100 + md.day;
}

/** `md` in `year`, moved by whole weeks; the result keeps its own year. */
export function addWeeks(md: MonthDayDto, weeks: number, year: number): DatedMonthDay {
  return addDays(md, weeks * 7, year);
}

/** `md` in `year`, moved by days; the result keeps its own year. */
export function addDays(md: MonthDayDto, days: number, year: number): DatedMonthDay {
  return fromUtc(Date.UTC(year, md.month - 1, md.day) + days * MS_DAY);
}

function fromUtc(utc: number): DatedMonthDay {
  const d = new Date(utc);
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    year: d.getUTCFullYear(),
  };
}
