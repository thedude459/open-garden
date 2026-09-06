# Shared types (planner visualization)

Source of truth: `libs/shared-types`. This file is the contract sketch for
fields added in 008 (2026-08-21). Zod schemas live next to the interfaces.

```ts
export type StartMethod = 'direct_seed' | 'transplant';

export interface LayoutAreaDto {
  id: string;
  name: string;
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
}

export interface LayoutAreaPutDto {
  id: string;
  name: string;
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
}

export interface GardenLayoutDto {
  gardenId: string;
  myRole: GardenRole;
  beds: LayoutBedDto[];
  areas: LayoutAreaDto[];
  plantings: LayoutPlantingDto[];
  flags: LayoutFlagDto[];
}

export interface LayoutPutDto {
  beds: LayoutBedPutDto[];
  areas: LayoutAreaPutDto[];
  placements: LayoutPlacementDto[];
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
  startMethod: StartMethod;
  indoorStartedOn: IsoDate | null;
  placement: LayoutPlacementDto | null;
}

export interface PlantingCreateDto {
  id?: string;
  plantId: string;
  startMethod: StartMethod;
  indoorStartedOn?: IsoDate | null;
  plantedOn?: IsoDate | null;
  harvestedOn?: IsoDate | null;
  bedId?: string | null;
  clientMutationId?: string;
}

export interface PlantingDto {
  /* existing 004 fields */
  startMethod: StartMethod;
  indoorStartedOn: IsoDate | null;
}

export interface TransplantListDto {
  gardenId: string;
  myRole: GardenRole;
  plantings: LayoutPlantingDto[]; // unplaced transplants only
  indoorReminders: ReminderItemDto[];
}
```

**Invariants** (also in Zod):

- `direct_seed` ⇒ `indoorStartedOn` null
- `transplant` ⇒ `indoorStartedOn` YYYY-MM-DD
- Tray membership: `startMethod === 'transplant' && placement === null`
