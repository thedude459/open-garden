import type { MonthDayDto, SeasonalWindowDto } from '@open-garden/shared-types';
import { mdKey } from './month-day';

export function overlapsThisWeek(
  startWindows: Array<SeasonalWindowDto | null | undefined>,
  todayLocal: Date,
): boolean {
  const days = localWeekDays(todayLocal);
  return startWindows.some((window) => window != null && days.some((day) => inWindow(day, window)));
}

export function localWeekDays(todayLocal: Date): MonthDayDto[] {
  const days: MonthDayDto[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate() + i);
    days.push({ month: d.getMonth() + 1, day: d.getDate() });
  }
  return days;
}

function inWindow(day: MonthDayDto, window: SeasonalWindowDto): boolean {
  const k = mdKey(day);
  const a = mdKey(window.earliest);
  const b = mdKey(window.latest);
  if (window.wrapsYear) return k >= a || k <= b;
  return k >= a && k <= b;
}
