# Shared TypeScript contracts (load performance)

Types in this document MUST be implemented in `libs/shared-types` and imported by `apps/api` and `apps/web`. Do not duplicate.

Additive fields only. Existing garden/plant/layout fields stay.

```ts
export interface GardenSummaryDto {
  id: string;
  name: string;
  hardinessZone: number | null;
  myRole: GardenRole;
  /** Beds in this garden; 0 if none. */
  bedCount: number;
  /** Placed plantings (bed + layout coords); 0 if none. Tray-only rows excluded. */
  placementCount: number;
}

export interface GardenDetailDto extends GardenSummaryDto {
  notes: string | null;
  lastFrost: MonthDayDto | null;
  firstFrost: MonthDayDto | null;
  ownerUserId: string;
  members: MemberDto[];
  updatedAt: string;
}

export interface PlantSummaryDto {
  id: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number;
  zoneMax: number;
  spacingInches: number;
  /** Public picture location when the catalog has one; otherwise null (client stand-in). */
  illustrationUrl: string | null;
}
```

`PlantDetailDto` continues to `Omit<PlantSummaryDto, 'spacingInches'>` and therefore includes `illustrationUrl`.

Favorites nested plants MAY carry `illustrationUrl`; this feature does not require favorites UI to use it.

Zod: list/detail mapping in `toSummary` / garden list mapping; `bedCount` / `placementCount` integers ≥ 0; `illustrationUrl` `z.string().nullable()`.
