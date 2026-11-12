import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';
import type { BedSite, BedStation, Mulch } from './placement';
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
  sun?: 'full' | 'part' | 'shade' | null;
  site?: BedSite;
  station?: BedStation | null;
  mulch?: Mulch;
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
  sunRequirements?: string | null;
  family?: string | null;
  life?: 'annual' | 'perennial' | 'tree';
  spacingFeet?: number | null;
  rootstock?: string | null;
}

export type LayoutFlagKind =
  'spacing' | 'fit' | 'unavailable' | 'sun' | 'repeat' | 'companion' | 'area';

export interface LayoutFlagDto {
  kind: LayoutFlagKind;
  plantingIds: string[];
  blocking: boolean;
  message?: string;
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
  priorCrops?: PriorCropDto[];
  pairs?: CompanionPairDto[];
}

export interface PriorCropDto {
  bedId: string;
  plantId: string;
  commonName: string;
  /** For rotation advice: a crop of the same family in the same bed. */
  family?: string | null;
}

export type CompanionKind = 'helps' | 'hinders' | 'pollinates';

export interface CompanionPairDto {
  id: string;
  plantId: string;
  otherPlantId: string;
  plantName: string;
  otherName: string;
  kind: CompanionKind;
  reason: string;
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
