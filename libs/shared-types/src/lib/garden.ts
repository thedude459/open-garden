/** How a member sees lengths. Lengths are stored in inches either way (ADR 0024). */
export const UNITS = ['imperial', 'metric'] as const;
export type Units = (typeof UNITS)[number];

export type GardenRole = 'owner' | 'collaborator' | 'viewer';

export interface MonthDayDto {
  month: number;
  day: number;
}

export interface MemberDto {
  userId: string;
  email: string;
  displayName: string | null;
  role: GardenRole;
}

export interface GardenSummaryDto {
  id: string;
  name: string;
  hardinessZone: number | null;
  myRole: GardenRole;
  bedCount: number;
  placementCount: number;
  overdueCount?: number;
  thisWeekCount?: number;
  /** The property's size and each sized bed's outline, in inches, for a small plan on its card. */
  plan?: GardenPlanOutlineDto;
}

/** A bed as drawn on the plan: its corner and its size once turned. */
export interface PlanOutlineRectDto {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GardenPlanOutlineDto {
  lengthInches: number;
  widthInches: number;
  beds: PlanOutlineRectDto[];
}

export interface TodayTaskDto {
  gardenId: string;
  gardenName: string;
  kind: 'overdue' | 'dueToday' | 'thisWeek';
  title: string;
  bedName: string | null;
  /** Care tasks (overdue, due today) carry the reminder, so Today can complete it. */
  reminder?: {
    plantingId: string;
    kind: import('./reminders').CareKind;
    dueOn: string;
    intervalDays: number | null;
  };
  /** Members who can only view see tasks but cannot complete them. */
  canEdit?: boolean;
}

/**
 * Weather in the next few days that can hurt plants in beds: frost for crops
 * that cannot take it, or heat above a crop's growing range. Advice only.
 */
export interface WeatherAlertDto {
  kind: 'frost' | 'heat';
  /** The day it is forecast, YYYY-MM-DD. */
  date: string;
  /** The forecast low (frost) or high (heat) that day, °C. */
  tempC: number;
  /** The plants in beds at risk, by name, with their bed. */
  plantings: { name: string; bedName: string | null }[];
}

export interface TodayDto {
  tasks: TodayTaskDto[];
  gardens: { id: string; overdue: number; thisWeek: number }[];
  /** Frost and heat ahead for each property; absent from older cached copies. */
  alerts?: (WeatherAlertDto & { gardenId: string; gardenName: string })[];
}

export interface SeasonPlantingDto {
  id: string;
  plantId: string;
  commonName: string;
  bedId: string | null;
  bedName: string | null;
  note: string | null;
  harvestedOn: string | null;
  life: 'annual' | 'perennial' | 'tree';
  family?: string | null;
}

export interface SeasonDto {
  openYear: number;
  closedYear: number | null;
  review: SeasonPlantingDto[];
  plantAgain: { plantId: string; bedId: string; commonName: string; bedName: string }[];
  pairs: import('./layout').CompanionPairDto[];
  householdPlants: { id: string; commonName: string }[];
}

export interface PlaceCandidateDto {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  postalCode: string | null;
  countryCode: string | null;
}

export interface PlaceLookupDto {
  candidates: PlaceCandidateDto[];
  truncated: boolean;
}

export interface GardenDetailDto extends GardenSummaryDto {
  notes: string | null;
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
  /** No frost dates, but monthly temperatures place sowing instead (ADR 0025). */
  frostFree: boolean;
  /** Mean daily temperature in each month, January first, °C; null when unknown. */
  monthlyMeanC: number[] | null;
  /** From the climate data: frost after `lateLastFrost` in 1 spring in 10, before `earlyFirstFrost` in 1 autumn in 10. */
  frostRisk: { lateLastFrost: MonthDayDto; earlyFirstFrost: MonthDayDto } | null;
  lengthInches: number;
  widthInches: number;
  ownerUserId: string;
  members: MemberDto[];
  updatedAt: string;
  place: PlaceCandidateDto | null;
}

export interface GardenWriteDto extends GardenDetailDto {
  seasonNotice: string | null;
}

export interface GardenCreateDto {
  name: string;
  notes?: string | null;
  hardinessZone?: number | null;
  lastFrost?: MonthDayDto | null;
  firstFrost?: MonthDayDto | null;
  lengthInches?: number;
  widthInches?: number;
  place?: PlaceCandidateDto;
}

export interface GardenPatchDto {
  name?: string;
  notes?: string | null;
  hardinessZone?: number | null;
  lastFrost?: MonthDayDto | null;
  firstFrost?: MonthDayDto | null;
  lengthInches?: number;
  widthInches?: number;
  place?: PlaceCandidateDto;
}

export interface GardenInviteDto {
  email: string;
  role: Exclude<GardenRole, 'owner'>;
}

export interface GardenMemberPatchDto {
  role: GardenRole;
}
