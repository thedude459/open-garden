import type {
  CalendarWindowsDto,
  GrowingGuidanceDto,
  MonthDayDto,
  SeasonalWindowDto,
  SowingTemperatureDto,
} from '@open-garden/shared-types';
import { computeWindows, seasonYear, windowsAvailable, type GardenFrost } from './windows';

/** One row of a crop's year: a window and where it falls across the months. */
export interface TimelineRow {
  kind: keyof CalendarWindowsDto;
  label: string;
  window: SeasonalWindowDto;
  /** Spans as percentages of the year from 1 January; a window over the year end has two. */
  spans: { startPct: number; widthPct: number }[];
}

const LABELS: Record<keyof CalendarWindowsDto, string> = {
  indoorStart: 'Start indoors',
  outdoorSow: 'Sow outdoors',
  transplant: 'Plant out',
  fallSow: 'Sow for fall',
  harvest: 'Harvest',
};

const ORDER = Object.keys(LABELS) as (keyof CalendarWindowsDto)[];

/** Days before each month in a common year. */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/**
 * A crop's sowing, planting, and harvest windows at one property this
 * season, laid out across the year; null when the property has neither
 * frost dates nor monthly temperatures to place them by.
 */
export function plantTimeline(
  place: GardenFrost & { monthlyMeanC: readonly number[] | null },
  plant: {
    growingGuidance: GrowingGuidanceDto;
    sowingTemperature: SowingTemperatureDto | null;
    daysToMaturity: number | null;
  },
  today: Date,
): TimelineRow[] | null {
  if (!windowsAvailable(place, place.monthlyMeanC)) return null;
  const windows = computeWindows(
    place,
    plant.growingGuidance,
    plant.daysToMaturity,
    seasonYear(place, today),
    { monthlyMeanC: place.monthlyMeanC, sowingTemperature: plant.sowingTemperature },
  );
  return ORDER.flatMap((kind) => {
    const window = windows[kind];
    return window ? [{ kind, label: LABELS[kind], window, spans: spans(window) }] : [];
  });
}

/** Where in the year a window falls; a 29 February counts as 28 February. */
function spans(window: SeasonalWindowDto): TimelineRow['spans'] {
  const a = dayOfYear(window.earliest);
  const b = dayOfYear(window.latest) + 1;
  const pct = (from: number, to: number) => ({
    startPct: (from / 365) * 100,
    widthPct: ((to - from) / 365) * 100,
  });
  return window.wrapsYear ? [pct(a, 365), pct(0, b)] : [pct(a, b)];
}

function dayOfYear(md: MonthDayDto): number {
  return MONTH_START[md.month - 1]! + Math.min(md.day, md.month === 2 ? 28 : 31) - 1;
}
