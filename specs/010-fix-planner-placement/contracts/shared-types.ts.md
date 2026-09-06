# Shared types (planner placement)

Source of truth: `libs/shared-types`. Additive catalog summary field only.
Layout / planting types stay as in 008.

```ts
export interface PlantSummaryDto {
  id: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number;
  zoneMax: number;
  /** Present on list items; catalog admission requires a known value. */
  spacingInches: number;
}

export interface PlantDetailDto extends Omit<PlantSummaryDto, 'spacingInches'> {
  spacingInches: number | null; // leftover rows may still be null
  // …existing detail fields
}

export interface PlantListQueryDto {
  q?: string;
  zone?: number;
  plantType?: PlantType;
  page?: number;
  pageSize?: number;
}

export interface FavoriteListItemDto {
  favoriteId: string;
  plant: Omit<PlantSummaryDto, 'spacingInches'> & {
    spacingInches: number | null;
    status: PlantStatus;
  };
  createdAt: string;
  unavailable: boolean;
}
```

FR-010 pickers are list/search/sync. Leftover favorites MAY still appear as `unavailable` with null spacing.

Layout placement (unchanged; Bed View catalog drop produces this on the draft, then Save):

```ts
startMethod: 'direct_seed';
placement: { plantingId: string; bedId: string; xInches: number; yInches: number };
```

Zod: list **response** items use `spacingInches: z.number().int().positive()` (or existing integer spacing bounds). Query schema unchanged. No list-item Zod file is required if mapping is `toSummary` only.
