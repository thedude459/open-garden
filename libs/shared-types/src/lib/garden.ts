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
