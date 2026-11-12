import type { GardenRole, MonthDayDto } from './garden';
import type { PlantStatus, PlantType } from './plant';

export type FrostAnchor = 'last' | 'first';

export interface SeasonalWindowDto {
  earliest: MonthDayDto;
  latest: MonthDayDto;
  wrapsYear: boolean;
}

export interface FrostRelativeWeeksDto {
  frostAnchor: FrostAnchor;
  weeksEarliest: number;
  weeksLatest: number;
}

export interface GrowingGuidanceDto {
  indoorStart: FrostRelativeWeeksDto | null;
  outdoorSow: FrostRelativeWeeksDto | null;
  transplant: FrostRelativeWeeksDto | null;
}

export interface CalendarWindowsDto {
  indoorStart: SeasonalWindowDto | null;
  outdoorSow: SeasonalWindowDto | null;
  transplant: SeasonalWindowDto | null;
  harvest: SeasonalWindowDto | null;
}

export interface CalendarEntryDto {
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
  zoneMin: number;
  zoneMax: number;
  zoneMismatch: boolean | null;
  windows: CalendarWindowsDto;
  /** On the household's plan (added from the calendar's search). */
  planned: boolean;
  /** Has a planting this season; it stays on the calendar while it does. */
  planted: boolean;
}

export interface CalendarDto {
  gardenId: string;
  myRole: GardenRole;
  windowsAvailable: boolean;
  hardinessZone: number | null;
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
  entries: CalendarEntryDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CalendarAddDto {
  plantId: string;
}

/** A month averaging this or warmer seldom sees a frost night (ADR 0025). */
export const FROST_RARE_MEAN_C = 7;

/**
 * Frost is rare here: twelve monthly mean temperatures, the coldest at least
 * FROST_RARE_MEAN_C. Where this holds and there are no frost dates, sowing
 * windows follow the monthly temperatures instead.
 * ponytail: one threshold on the coldest month; a frost-night count per year
 * from the same daily data would be more exact.
 */
export function frostRare(monthlyMeanC: readonly number[] | null | undefined): boolean {
  return monthlyMeanC?.length === 12 && Math.min(...monthlyMeanC) >= FROST_RARE_MEAN_C;
}
