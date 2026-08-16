import type { PlantType } from '@open-garden/shared-types';
import type { GrowingGuidanceDto } from '@open-garden/shared-types';

export interface ProviderPlant {
  externalId: string;
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
  growingGuidance?: GrowingGuidanceDto | null;
}

export interface PlantDataProvider {
  readonly id: string;
  searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]>;
  listPage(options?: { cursor?: string; limit?: number }): Promise<{
    items: ProviderPlant[];
    nextCursor?: string;
  }>;
}
