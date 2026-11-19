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
  /** The day the household means to sow or plant out (ADR 0040). */
  plannedOn?: IsoDate | null;
  /** The day it was really sown or planted out; null while it is planned. */
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
  /** Each day something was picked from this planting, oldest first. */
  harvests?: HarvestDto[];
  createdAt: string;
  updatedAt: string;
}

/** One day's harvest from a planting (ADR 0038): a weight in grams, a count, both, or neither. */
export interface HarvestDto {
  harvestedOn: IsoDate;
  grams: number | null;
  count: number | null;
}

/** One crop's harvests in a season, with its totals. */
export interface CropHarvestDto {
  /** The crop's name (a variety's harvests count toward its crop). */
  name: string;
  grams: number;
  count: number;
  harvests: (HarvestDto & { plantingId: string; plantName: string })[];
}

/** A property's harvests for one season, by crop, and the seasons that have any. */
export interface HarvestTotalsDto {
  seasonYear: number;
  seasons: number[];
  crops: CropHarvestDto[];
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
  /** The season listed (ADR 0040): the current one or the next. */
  seasonYear?: number;
  currentSeasonYear?: number;
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
  /** The season it belongs to: the current one (default) or the next, to plan it. */
  seasonYear?: number;
  startMethod?: StartMethod;
  indoorStartedOn?: IsoDate | null;
  plannedOn?: IsoDate | null;
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
  plannedOn?: IsoDate | null;
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
