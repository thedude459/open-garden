# Shared TypeScript contracts (garden layout)

Types in this document MUST be implemented in `libs/shared-types` and imported
by `apps/api` and `apps/web`. Do not duplicate. Existing plant/garden/auth/
calendar/planting DTOs stay; this feature MAY add optional geometry fields only
on **new** layout types, not on `NamedBedDto` / `PlantingDto` used by the
planting list (the list stays geometry-free).

```ts
import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';

/** 90-degree steps only. */
export type BedOrientation = 0 | 90 | 180 | 270;

export interface BedGeometryDto {
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
  orientation: BedOrientation;
}

export interface LayoutBedDto {
  id: string;
  name: string;
  geometry: BedGeometryDto | null;
}

export interface LayoutPlacementDto {
  plantingId: string;
  bedId: string;
  xInches: number;
  yInches: number;
}

export interface LayoutPlantingDto {
  id: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
  bedId: string | null;
  spacingInches: number | null;
  placement: LayoutPlacementDto | null;
}

export type LayoutFlagKind = 'spacing' | 'fit' | 'unavailable';

export interface LayoutFlagDto {
  kind: LayoutFlagKind;
  plantingIds: string[];
  blocking: boolean;
}

export interface GardenLayoutDto {
  gardenId: string;
  myRole: GardenRole;
  beds: LayoutBedDto[];
  plantings: LayoutPlantingDto[];
  flags: LayoutFlagDto[];
}

export interface LayoutBedPutDto {
  id: string;
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
  orientation: BedOrientation;
}

export interface LayoutPutDto {
  beds: LayoutBedPutDto[];
  placements: LayoutPlacementDto[];
}
```

Zod schemas (`layoutPutSchema`, `bedOrientationSchema`) live next to these
types. Inches MUST be finite integers (Zod `int`). Length and width MUST be
≥ 1. `evaluateLayout` in `libs/garden-layout` enforces spacing/fit (Zod does
not duplicate the geometry math).

Reuse existing `ApiErrorDto`. Do not put SVG/viewBox types in `shared-types`.
