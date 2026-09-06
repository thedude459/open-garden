import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';

/** Household calendar date `YYYY-MM-DD`, or null when unset. */
export type IsoDate = string;

export type StartMethod = 'direct_seed' | 'transplant';

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
  startMethod: StartMethod;
  indoorStartedOn: IsoDate | null;
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
  startMethod?: StartMethod;
  indoorStartedOn?: IsoDate | null;
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
  lengthInches: number;
  widthInches: number;
  originXInches?: number;
  originYInches?: number;
}

export interface BedPatchDto {
  name: string;
}
