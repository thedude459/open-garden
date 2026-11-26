import type { CatalogPestDto, PlantType } from '@open-garden/shared-types';
import type {
  CompanionBenefit,
  CompanionEvidence,
  CompanionPlaceDto,
  GrowingGuidanceDto,
  CropCoefficientsDto,
  FrostTolerance,
  RootstockSpacingDto,
  SoilPhDto,
  SowingTemperatureDto,
} from '@open-garden/shared-types';

export interface ProviderPlant {
  externalId: string;
  /**
   * Catalog key for a source with its own stable ids (the dataset). Without
   * it, records are keyed and merged by species and cultivar.
   */
  varietyKey?: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number | null;
  zoneMax: number | null;
  sunRequirements: string | null;
  waterNeeds: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
  waterIntervalDays?: number | null;
  fertilizeIntervalDays?: number | null;
  growingGuidance?: GrowingGuidanceDto | null;
  rootstockSpacingInches?: RootstockSpacingDto | null;
  sowingTemperature?: SowingTemperatureDto | null;
  soilPh?: SoilPhDto | null;
  cropCoefficients?: CropCoefficientsDto | null;
  /** Botanical family, by its common name ("Cabbage family"). */
  family?: string | null;
  /** The dataset crop a plant or variety belongs to; companion pairs name crops. */
  cropId?: string | null;
  /** How much frost the crop survives, for weather alerts. */
  frostTolerance?: FrostTolerance | null;
  /** Lives for years (asparagus, rhubarb), so its planting outlives a season. */
  perennial?: boolean | null;
}

/** A companion pair between two crops, by dataset crop id. */
export interface ProviderCompanion {
  crops: [string, string];
  kind: 'helps' | 'hinders';
  benefits: CompanionBenefit[];
  evidence: CompanionEvidence;
  reason: string;
  reference: string | null;
  shownIn: CompanionPlaceDto[];
}

/** A pest or disease, with its regional guidance (ADR 0045). */
export type ProviderPest = CatalogPestDto;

export interface PlantDataProvider {
  readonly id: string;
  searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]>;
  listPage(options?: { cursor?: string; limit?: number }): Promise<{
    items: ProviderPlant[];
    nextCursor?: string;
    /** Records on this page the source could not read and left out. */
    skipped?: number;
  }>;
  /** Companion pairs, for a source that has them (the dataset). */
  companions?(): Promise<ProviderCompanion[]>;
  /** Pests and diseases, for a source that has them (the dataset). */
  pests?(): Promise<ProviderPest[]>;
}
