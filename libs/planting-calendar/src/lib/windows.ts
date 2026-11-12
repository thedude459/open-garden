import type {
  CalendarWindowsDto,
  FrostRelativeWeeksDto,
  GrowingGuidanceDto,
  MonthDayDto,
  SeasonalWindowDto,
} from '@open-garden/shared-types';
import { addDays, addWeeks, mdKey, type DatedMonthDay } from './month-day';

export interface GardenFrost {
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
}

export function frostComplete(frost: GardenFrost): boolean {
  return frost.lastFrost != null && frost.firstFrost != null;
}

/** A season wraps the year end when first frost falls earlier in the calendar year (south). */
function seasonWraps(frost: GardenFrost): boolean {
  return frost.lastFrost != null && frost.firstFrost != null
    ? mdKey(frost.firstFrost) < mdKey(frost.lastFrost)
    : false;
}

/**
 * The calendar year of the current season's last frost: this year, or last
 * year while a season that wraps the year end has not reached its first frost.
 */
export function seasonYear(frost: GardenFrost, today: Date): number {
  const year = today.getFullYear();
  if (!seasonWraps(frost) || !frost.firstFrost) return year;
  const todayKey = mdKey({ month: today.getMonth() + 1, day: today.getDate() });
  return todayKey <= mdKey(frost.firstFrost) ? year - 1 : year;
}

/**
 * Sowing, planting, and harvest windows for one season. Dates are worked out
 * in real years (last frost in `year`, first frost in the year it falls), so
 * windows that cross 29 February or the year end land on the right day.
 */
export function computeWindows(
  frost: GardenFrost,
  guidance: GrowingGuidanceDto,
  daysToMaturity: number | null,
  year: number,
): CalendarWindowsDto {
  if (!frostComplete(frost)) {
    return emptyWindows();
  }
  const firstFrostYear = seasonWraps(frost) ? year + 1 : year;
  const window = (g: FrostRelativeWeeksDto | null) =>
    windowFromGuidance(frost, g, g?.frostAnchor === 'last' ? year : firstFrostYear);
  const indoorStart = window(guidance.indoorStart);
  const outdoorSow = window(guidance.outdoorSow);
  const transplant = window(guidance.transplant);
  const start = transplant ?? outdoorSow ?? indoorStart;
  const harvest =
    start && daysToMaturity != null && daysToMaturity > 0
      ? {
          earliest: addDays(start.earliest, daysToMaturity, start.earliest.year),
          latest: addDays(start.latest, daysToMaturity, start.latest.year),
        }
      : null;
  return {
    indoorStart: toSeasonalWindow(indoorStart),
    outdoorSow: toSeasonalWindow(outdoorSow),
    transplant: toSeasonalWindow(transplant),
    harvest: toSeasonalWindow(harvest),
  };
}

function emptyWindows(): CalendarWindowsDto {
  return { indoorStart: null, outdoorSow: null, transplant: null, harvest: null };
}

interface DatedWindow {
  earliest: DatedMonthDay;
  latest: DatedMonthDay;
}

function windowFromGuidance(
  frost: GardenFrost,
  guidance: FrostRelativeWeeksDto | null,
  anchorYear: number,
): DatedWindow | null {
  if (!guidance) return null;
  const anchor = guidance.frostAnchor === 'last' ? frost.lastFrost : frost.firstFrost;
  if (!anchor) return null;
  return {
    earliest: addWeeks(anchor, guidance.weeksEarliest, anchorYear),
    latest: addWeeks(anchor, guidance.weeksLatest, anchorYear),
  };
}

function toSeasonalWindow(window: DatedWindow | null): SeasonalWindowDto | null {
  if (!window) return null;
  const { earliest, latest } = window;
  const earliestMd = { month: earliest.month, day: earliest.day };
  const latestMd = { month: latest.month, day: latest.day };
  return {
    earliest: earliestMd,
    latest: latestMd,
    wrapsYear: earliest.year !== latest.year || mdKey(earliestMd) > mdKey(latestMd),
  };
}
