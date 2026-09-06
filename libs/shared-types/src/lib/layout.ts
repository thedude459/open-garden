import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';
import type { IsoDate, StartMethod } from './planting';
import type { ReminderItemDto } from './reminders';

export type { StartMethod } from './planting';

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
  startMethod: StartMethod;
  indoorStartedOn: IsoDate | null;
  placement: LayoutPlacementDto | null;
}

export type LayoutFlagKind = 'spacing' | 'fit' | 'unavailable';

export interface LayoutFlagDto {
  kind: LayoutFlagKind;
  plantingIds: string[];
  blocking: boolean;
}

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
  areas: LayoutAreaPutDto[];
  placements: LayoutPlacementDto[];
}

export interface TransplantListDto {
  gardenId: string;
  myRole: GardenRole;
  plantings: LayoutPlantingDto[];
  indoorReminders: ReminderItemDto[];
}
