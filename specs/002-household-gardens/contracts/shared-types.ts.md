# Shared TypeScript contracts (household gardens)

Types in this document MUST be implemented in `libs/shared-types` and imported
by `apps/api` and `apps/web`. Do not duplicate. Existing plant/auth DTOs stay.

```ts
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
}

export interface GardenDetailDto extends GardenSummaryDto {
  notes: string | null;
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
  ownerUserId: string;
  members: MemberDto[];
  updatedAt: string;
}

export interface GardenCreateDto {
  name: string;
  notes?: string | null;
  hardinessZone?: number | null;
  lastFrost?: MonthDayDto | null;
  firstFrost?: MonthDayDto | null;
}

export interface GardenPatchDto {
  name?: string;
  notes?: string | null;
  hardinessZone?: number | null;
  lastFrost?: MonthDayDto | null;
  firstFrost?: MonthDayDto | null;
}

export interface GardenInviteDto {
  email: string;
  role: Exclude<GardenRole, 'owner'>;
}

export interface GardenMemberPatchDto {
  role: GardenRole;
}
```

Reuse existing `PageDto<T>` and `ApiErrorDto` from the plant-database contracts.
