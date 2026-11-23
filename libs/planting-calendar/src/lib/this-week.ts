import type { CalendarWindowsDto, MonthDayDto, SeasonalWindowDto } from '@open-garden/shared-types';
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

/**
 * The day to plan a crop's sowing or planting out for (ADR 0040): today while
 * one of its start windows is open, else the first day of the next one, in
 * `seasonYear`. A direct seed uses the sowing window, a transplant the
 * planting-out window, and both the fall sowing window. Null when every
 * window of the season has passed, or none is known.
 */
export function suggestedPlannedOn(
  windows: CalendarWindowsDto,
  startMethod: 'direct_seed' | 'transplant',
  seasonYear: number,
  todayLocal: Date,
): string | null {
  const today = isoDay(todayLocal.getFullYear(), {
    month: todayLocal.getMonth() + 1,
    day: todayLocal.getDate(),
  });
  const first = startMethod === 'transplant' ? windows.transplant : windows.outdoorSow;
  const days: string[] = [];
  for (const window of [first, windows.fallSow]) {
    if (!window) continue;
    const from = isoDay(seasonYear, window.earliest);
    const to = isoDay(window.wrapsYear ? seasonYear + 1 : seasonYear, window.latest);
    if (today > to) continue;
    days.push(today >= from ? today : from);
  }
  return days.sort()[0] ?? null;
}

function isoDay(year: number, md: MonthDayDto): string {
  return `${year}-${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
}
