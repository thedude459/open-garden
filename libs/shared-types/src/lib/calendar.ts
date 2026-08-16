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
