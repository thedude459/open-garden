import type { GardenRole } from './garden';
import type { AreaKind, BedSite, BedStation, Mulch } from './placement';
import type { PlantStatus, PlantType } from './plant';

/** Household calendar date `YYYY-MM-DD`, or null when unset. */
export type IsoDate = string;

export type StartMethod = 'direct_seed' | 'transplant';

export type PlantingLife = 'annual' | 'perennial' | 'tree';
export type BedSun = 'full' | 'part' | 'shade';
export type BedKind = 'bed' | 'orchard';

export interface NamedBedDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sun?: BedSun | null;
  kind?: BedKind;
  site?: BedSite;
  station?: BedStation | null;
  mulch?: Mulch;
  areaId?: string | null;
}

export interface PropertyAreaDto {
  id: string;
  name: string;
  kind: AreaKind;
}

export interface TrayDto {
  id: string;
  areaId: string;
  name: string;
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
  trayId?: string | null;
  startMethod: StartMethod;
  indoorStartedOn: IsoDate | null;
  life?: PlantingLife;
  seasonYear?: number;
  note?: string | null;
  photo?: string | null;
  plantedYear?: number | null;
  rootstock?: string | null;
  yearsToFruit?: number | null;
  spacingFeet?: number | null;
  harvests?: IsoDate[];
  createdAt: string;
  updatedAt: string;
}

export interface PlantingListDto {
  gardenId: string;
  myRole: GardenRole;
  beds: NamedBedDto[];
  plantings: PlantingDto[];
  areas?: PropertyAreaDto[];
  trays?: TrayDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PlantingCreateDto {
  id?: string;
  plantId: string;
  startMethod?: StartMethod;
  indoorStartedOn?: IsoDate | null;
  plantedOn?: IsoDate | null;
  harvestedOn?: IsoDate | null;
  bedId?: string | null;
  trayId?: string | null;
  clientMutationId?: string;
  life?: PlantingLife;
  note?: string | null;
  photo?: string | null;
  plantedYear?: number | null;
  rootstock?: string | null;
  yearsToFruit?: number | null;
  spacingFeet?: number | null;
}

export interface PlantingPatchDto {
  plantedOn?: IsoDate | null;
  harvestedOn?: IsoDate | null;
  bedId?: string | null;
  trayId?: string | null;
  clientMutationId?: string;
  life?: PlantingLife;
  note?: string | null;
  photo?: string | null;
  plantedYear?: number | null;
  rootstock?: string | null;
  yearsToFruit?: number | null;
  spacingFeet?: number | null;
}

export interface BedCreateDto {
  id?: string;
  name: string;
  lengthInches: number;
  widthInches: number;
  originXInches?: number;
  originYInches?: number;
  kind?: BedKind;
  site?: BedSite;
  station?: BedStation;
  mulch?: Mulch;
  areaId?: string;
}

export interface BedPatchDto {
  name: string;
  sun?: BedSun | null;
  kind?: BedKind;
  site?: BedSite;
  mulch?: Mulch;
}
