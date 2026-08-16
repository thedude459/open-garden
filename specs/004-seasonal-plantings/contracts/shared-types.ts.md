# Shared TypeScript contracts (seasonal plantings)

Types in this document MUST be implemented in `libs/shared-types` and imported
by `apps/api` and `apps/web`. Do not duplicate. Existing plant/garden/auth/
calendar DTOs stay unchanged. This feature MUST NOT add fields to
`CalendarDto` or `FavoriteListItemDto`.

```ts
import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';

/** Household calendar date `YYYY-MM-DD`, or null when unset. */
export type IsoDate = string;

export interface NamedBedDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlantingDto {
  id: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
  plantedOn: IsoDate | null;
  harvestedOn: IsoDate | null;
  bedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlantingListDto {
  gardenId: string;
  myRole: GardenRole;
  beds: NamedBedDto[];
  plantings: PlantingDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PlantingCreateDto {
  id?: string;
  plantId: string;
  plantedOn?: IsoDate | null;
  harvestedOn?: IsoDate | null;
  bedId?: string | null;
  clientMutationId?: string;
}

export interface PlantingPatchDto {
  plantedOn?: IsoDate | null;
  harvestedOn?: IsoDate | null;
  bedId?: string | null;
  clientMutationId?: string;
}

export interface BedCreateDto {
  id?: string;
  name: string;
}

export interface BedPatchDto {
  name: string;
}
```

Zod schemas (`plantingCreateSchema`, `plantingPatchSchema`, `bedCreateSchema`,
`bedPatchSchema`, `plantingListQuerySchema`) live next to these types in
`libs/shared-types`. ISO date strings MUST match `YYYY-MM-DD` and be a real
calendar date. `assertDatePair` in `libs/seasonal-plantings` enforces harvest
≥ planted when both are non-null (Zod may call it or the service does).

Reuse existing `ApiErrorDto`. Grouping types (`PlantingGroup`) are domain-lib
helpers, not REST DTOs — do not put them in `shared-types`.
