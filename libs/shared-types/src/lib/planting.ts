import type { GardenRole } from './garden';
import type { AreaKind, BedSite, BedStation, Mulch } from './placement';
import type { PlantStatus, PlantType } from './plant';

/** Household calendar date `YYYY-MM-DD`, or null when unset. */
export type IsoDate = string;

export type StartMethod = 'direct_seed' | 'transplant';

export type PlantingLife = 'annual' | 'perennial' | 'tree';
export type BedSun = 'full' | 'part' | 'shade';

export interface NamedBedDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sun?: BedSun | null;
  site?: BedSite;
  station?: BedStation | null;
  mulch?: Mulch;
  areaId?: string | null;
}

/** A level as the soil lab reported it; labs differ in method and units, so only the level is kept. */
export type NutrientLevel = 'low' | 'medium' | 'high';

/**
 * One soil test (ADR 0033), of an area or of a bed whose soil differs; the
 * bed's own test wins. Every measurement is optional; a lab may report only some.
 */
export interface SoilTestDto {
  id: string;
  areaId: string | null;
  bedId: string | null;
  testedOn: IsoDate;
  lab: string | null;
  ph: number | null;
  organicMatterPct: number | null;
  nitrogen: NutrientLevel | null;
  phosphorus: NutrientLevel | null;
  potassium: NutrientLevel | null;
  /** The lab's own recommendations, as written. */
  recommendations: string | null;
}

export type SoilTestCreateDto = Omit<SoilTestDto, 'id' | 'areaId' | 'bedId'>;

/** What a soil test belongs to. */
export type SoilTestOwner = { areaId: string } | { bedId: string };

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

/** What a succession series added, and the sowings it left out (ADR 0037). */
export interface PlantingRepeatResultDto {
  list: PlantingListDto;
  added: number;
  /** Dates outside the crop's sowing windows here (summer heat for a cool crop). */
  outOfWindow: number;
  /** Dates too late to ripen before the first frost. */
  tooLate: number;
  /** The last sowing that ripens before the first frost, when it can be worked out. */
  lastSowOn: string | null;
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
  site?: BedSite;
  station?: BedStation;
  mulch?: Mulch;
  areaId?: string;
}

export interface BedPatchDto {
  name: string;
  sun?: BedSun | null;
  site?: BedSite;
  mulch?: Mulch;
  /** Move the bed to another area; its plants must suit it. */
  areaId?: string;
}
