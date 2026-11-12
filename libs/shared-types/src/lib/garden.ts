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

export interface TodayDto {
  tasks: TodayTaskDto[];
  gardens: { id: string; overdue: number; thisWeek: number }[];
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
