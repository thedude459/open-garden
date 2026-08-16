import type {
  CalendarWindowsDto,
  FrostRelativeWeeksDto,
  GrowingGuidanceDto,
  MonthDayDto,
  SeasonalWindowDto,
} from '@open-garden/shared-types';
import { addDays, addWeeks, mdKey } from './month-day';

export interface GardenFrost {
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
}

export function frostComplete(frost: GardenFrost): boolean {
  return frost.lastFrost != null && frost.firstFrost != null;
}

export function computeWindows(
  frost: GardenFrost,
  guidance: GrowingGuidanceDto,
  daysToMaturity: number | null,
): CalendarWindowsDto {
  if (!frostComplete(frost)) {
    return emptyWindows();
  }
  const indoorStart = windowFromGuidance(frost, guidance.indoorStart);
  const outdoorSow = windowFromGuidance(frost, guidance.outdoorSow);
  const transplant = windowFromGuidance(frost, guidance.transplant);
  const start = transplant ?? outdoorSow ?? indoorStart;
  const harvest =
    start && daysToMaturity != null && daysToMaturity > 0
      ? addDaysToWindow(start, daysToMaturity)
      : null;
  return { indoorStart, outdoorSow, transplant, harvest };
}

function emptyWindows(): CalendarWindowsDto {
  return { indoorStart: null, outdoorSow: null, transplant: null, harvest: null };
}

function windowFromGuidance(
  frost: GardenFrost,
  guidance: FrostRelativeWeeksDto | null,
): SeasonalWindowDto | null {
  if (!guidance) return null;
  const anchor = guidance.frostAnchor === 'last' ? frost.lastFrost : frost.firstFrost;
  if (!anchor) return null;
  const earliest = addWeeks(anchor, guidance.weeksEarliest);
  const latest = addWeeks(anchor, guidance.weeksLatest);
  return toSeasonalWindow(earliest, latest);
}

function addDaysToWindow(window: SeasonalWindowDto, days: number): SeasonalWindowDto {
  const earliest = addDays(window.earliest, days);
  const latest = addDays(window.latest, days);
  return toSeasonalWindow(earliest, latest);
}

function toSeasonalWindow(
  earliest: { month: number; day: number; year: number },
  latest: { month: number; day: number; year: number },
): SeasonalWindowDto {
  const earliestMd = { month: earliest.month, day: earliest.day };
  const latestMd = { month: latest.month, day: latest.day };
  return {
    earliest: earliestMd,
    latest: latestMd,
    wrapsYear: earliest.year !== latest.year || mdKey(earliestMd) > mdKey(latestMd),
  };
}
