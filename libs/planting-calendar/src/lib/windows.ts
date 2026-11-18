import type {
  CalendarWindowsDto,
  FrostRelativeWeeksDto,
  GrowingGuidanceDto,
  MonthDayDto,
  SeasonalWindowDto,
  SowingTemperatureDto,
} from '@open-garden/shared-types';
import { frostRare } from '@open-garden/shared-types';
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

/** Where it rarely frosts: the property's mean temperature in each month, January first. */
export interface WarmClimate {
  monthlyMeanC: readonly number[] | null;
  sowingTemperature: SowingTemperatureDto | null;
}

/**
 * Sowing, planting, and harvest windows for one season. With both frost dates
 * they hang off frost, worked out in real years (last frost in `year`, first
 * frost in the year it falls), so windows that cross 29 February or the year
 * end land on the right day. Without frost dates they follow the monthly
 * temperatures, when the property and the crop have them (ADR 0025).
 * A fall sowing needs the first frost, so it is left out there. Harvest
 * follows the first sowing or planting, not the fall one.
 */
export function computeWindows(
  frost: GardenFrost,
  guidance: GrowingGuidanceDto,
  daysToMaturity: number | null,
  year: number,
  warm: WarmClimate = { monthlyMeanC: null, sowingTemperature: null },
): CalendarWindowsDto {
  const dated = datedWindows(frost, guidance, year, warm);
  if (!dated) return emptyWindows();
  const { indoorStart, outdoorSow, transplant, fallSow } = dated;
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
    fallSow: toSeasonalWindow(fallSow),
    harvest: toSeasonalWindow(harvest),
  };
}

/** Windows can be worked out: both frost dates, or monthly temperatures where frost is rare. */
export function windowsAvailable(frost: GardenFrost, monthlyMeanC: readonly number[] | null) {
  return frostComplete(frost) || frostRare(monthlyMeanC);
}

/**
 * The months a crop can go in where it rarely frosts: the mean temperature
 * is within the crop's growing range and warm enough for its soil. The
 * window is the longest unbroken run of such months, which may wrap the year
 * end, from the 1st of its first month to the end of its last.
 * ponytail: one window per crop; a cool crop with two seasons (spring and
 * autumn in a hot place) gets the longer one. A second window needs a second
 * slot in the calendar.
 */
function warmMonths(warm: WarmClimate, year: number): DatedWindow | null {
  const means = warm.monthlyMeanC;
  const t = warm.sowingTemperature;
  if (!means || !frostRare(means) || !t) return null;
  const floor = Math.max(t.minC, t.minSoilC ?? t.minC);
  const ok = means.map((mean) => mean >= floor && mean <= t.maxC);
  if (ok.every(Boolean)) {
    return { earliest: { year, month: 1, day: 1 }, latest: { year, month: 12, day: 31 } };
  }
  let best: { start: number; length: number } | null = null;
  for (let start = 0; start < 12; start++) {
    if (!ok[start] || ok[(start + 11) % 12]) continue; // a run starts here
    let length = 0;
    while (length < 12 && ok[(start + length) % 12]) length++;
    if (!best || length > best.length) best = { start, length };
  }
  if (!best) return null;
  const endIndex = best.start + best.length - 1;
  const endYear = endIndex > 11 ? year + 1 : year;
  const endMonth = (endIndex % 12) + 1;
  return {
    earliest: { year, month: best.start + 1, day: 1 },
    latest: { year: endYear, month: endMonth, day: daysIn(endYear, endMonth) },
  };
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** One season's sowing and planting windows in real years, before harvest is added. */
interface DatedWindows {
  indoorStart: DatedWindow | null;
  outdoorSow: DatedWindow | null;
  transplant: DatedWindow | null;
  fallSow: DatedWindow | null;
}

function datedWindows(
  frost: GardenFrost,
  guidance: GrowingGuidanceDto,
  year: number,
  warm: WarmClimate,
): DatedWindows | null {
  if (frostComplete(frost)) {
    const firstFrostYear = seasonWraps(frost) ? year + 1 : year;
    const window = (g: FrostRelativeWeeksDto | null) =>
      windowFromGuidance(frost, g, g?.frostAnchor === 'last' ? year : firstFrostYear);
    return {
      indoorStart: window(guidance.indoorStart),
      outdoorSow: window(guidance.outdoorSow),
      transplant: window(guidance.transplant),
      fallSow: window(guidance.fallSow),
    };
  }
  const months = warmMonths(warm, year);
  if (!months) return null;
  return {
    indoorStart: null,
    outdoorSow: guidance.outdoorSow ? months : null,
    transplant: guidance.transplant ? months : null,
    fallSow: null,
  };
}

/** Where a sowing series may land, as ISO dates (ADR 0037). */
export interface SowingPlan {
  /** The windows a crop goes in this season: sowing (or planting out) and fall sowing. */
  windows: { from: string; to: string }[];
  /** The last sowing that ripens before the first frost; null without frost dates or maturity. */
  lastSowOn: string | null;
}

/**
 * Extension guidance for the last sowing, for a crop without a fall window:
 * count back from the first frost by
 * the days to maturity plus about two weeks for slower growth in cool, short
 * fall days, and two weeks more for a crop frost kills (Virginia Cooperative
 * Extension's "fall factor").
 */
export const FALL_FACTOR_DAYS = 14;

export function sowingPlan(
  frost: GardenFrost,
  guidance: GrowingGuidanceDto,
  daysToMaturity: number | null,
  frostTender: boolean,
  startMethod: string,
  year: number,
  warm: WarmClimate = { monthlyMeanC: null, sowingTemperature: null },
): SowingPlan {
  const dated = datedWindows(frost, guidance, year, warm);
  const main = startMethod === 'transplant' ? dated?.transplant : dated?.outdoorSow;
  const windows = [main, dated?.fallSow]
    .filter((w): w is DatedWindow => w != null)
    .map((w) => ({ from: isoOf(w.earliest), to: isoOf(w.latest) }));
  let lastSowOn: string | null = null;
  if (dated?.fallSow) {
    // A crop sown for fall (lettuce, peas, spinach) is hardy enough to grow on
    // through light frosts; the dataset's fall window already ends at its
    // last sowing, later than counting back from the first frost would.
    lastSowOn = isoOf(dated.fallSow.latest);
  } else if (frostComplete(frost) && daysToMaturity != null && daysToMaturity > 0) {
    const firstFrostYear = seasonWraps(frost) ? year + 1 : year;
    const back = daysToMaturity + FALL_FACTOR_DAYS + (frostTender ? FALL_FACTOR_DAYS : 0);
    lastSowOn = isoOf(addDays(frost.firstFrost!, -back, firstFrostYear));
  }
  return { windows, lastSowOn };
}

function isoOf(d: DatedMonthDay): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function emptyWindows(): CalendarWindowsDto {
  return { indoorStart: null, outdoorSow: null, transplant: null, fallSow: null, harvest: null };
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
