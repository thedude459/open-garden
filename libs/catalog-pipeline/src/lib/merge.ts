import { buildVarietyKey } from '@open-garden/plant-catalog';
import type { ProviderPlant } from '@open-garden/plant-provider';
import type { GrowingGuidanceDto, PlantType } from '@open-garden/shared-types';

const MERGE_FIELDS = [
  'commonName',
  'species',
  'cultivar',
  'plantType',
  'zoneMin',
  'zoneMax',
  'sunRequirements',
  'waterNeeds',
  'daysToMaturity',
  'spacingInches',
  'waterIntervalDays',
  'fertilizeIntervalDays',
  'growingGuidance',
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

export interface MergedPlant {
  varietyKey: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number;
  zoneMax: number;
  sunRequirements: string | null;
  waterNeeds: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
  waterIntervalDays: number | null;
  fertilizeIntervalDays: number | null;
  growingGuidance: GrowingGuidanceDto | null;
  provider: string;
  providerExternalId: string;
  contributingSources: string[];
  fieldWinners: Record<string, string>;
  sourceLinks: Array<{ sourceId: string; externalId: string }>;
}

export interface SourcePlantBatch {
  sourceId: string;
  plants: ProviderPlant[];
}

export interface MergeResult {
  merged: MergedPlant[];
  rejected: number;
}

function hasIdentity(plant: ProviderPlant): boolean {
  return Boolean(plant.commonName?.trim() && plant.species?.trim());
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

type Acc = {
  varietyKey: string;
  values: Partial<MergedPlant>;
  fieldWinners: Record<string, string>;
  contributingSources: string[];
  sourceLinks: Array<{ sourceId: string; externalId: string }>;
};

export function mergeCatalogRecords(
  batches: SourcePlantBatch[],
  sourceOrder: string[],
): MergeResult {
  const byId = new Map(batches.map((batch) => [batch.sourceId, batch]));
  const acc = new Map<string, Acc>();
  let rejected = 0;

  for (const sourceId of sourceOrder) {
    const batch = byId.get(sourceId);
    if (!batch) continue;
    for (const plant of batch.plants) {
      if (!hasIdentity(plant)) {
        rejected += 1;
        continue;
      }
      const varietyKey = buildVarietyKey(plant.species, plant.cultivar);
      let row = acc.get(varietyKey);
      if (!row) {
        row = {
          varietyKey,
          values: {},
          fieldWinners: {},
          contributingSources: [],
          sourceLinks: [],
        };
        acc.set(varietyKey, row);
      }
      if (!row.contributingSources.includes(sourceId)) {
        row.contributingSources.push(sourceId);
      }
      const existingLink = row.sourceLinks.find((link) => link.sourceId === sourceId);
      if (existingLink) {
        existingLink.externalId = plant.externalId;
      } else {
        row.sourceLinks.push({ sourceId, externalId: plant.externalId });
      }
      applyFields(row, plant, sourceId);
    }
  }

  const merged: MergedPlant[] = [];
  for (const row of acc.values()) {
    const commonName = row.values.commonName?.trim();
    const species = row.values.species?.trim();
    const plantType = row.values.plantType;
    const zoneMin = row.values.zoneMin;
    const zoneMax = row.values.zoneMax;
    if (!commonName || !species || !plantType || zoneMin == null || zoneMax == null) {
      rejected += 1;
      continue;
    }
    const last = row.sourceLinks[row.sourceLinks.length - 1];
    merged.push({
      varietyKey: row.varietyKey,
      commonName,
      species,
      cultivar: row.values.cultivar ?? null,
      plantType,
      zoneMin,
      zoneMax,
      sunRequirements: row.values.sunRequirements ?? null,
      waterNeeds: row.values.waterNeeds ?? null,
      daysToMaturity: row.values.daysToMaturity ?? null,
      spacingInches: row.values.spacingInches ?? null,
      waterIntervalDays: row.values.waterIntervalDays ?? null,
      fertilizeIntervalDays: row.values.fertilizeIntervalDays ?? null,
      growingGuidance: row.values.growingGuidance ?? null,
      provider: last?.sourceId ?? row.contributingSources[row.contributingSources.length - 1] ?? '',
      providerExternalId: last?.externalId ?? '',
      contributingSources: row.contributingSources,
      fieldWinners: row.fieldWinners,
      sourceLinks: row.sourceLinks,
    });
  }

  return { merged, rejected };
}

function applyFields(row: Acc, plant: ProviderPlant, sourceId: string) {
  const incoming: Record<MergeField, unknown> = {
    commonName: plant.commonName,
    species: plant.species,
    cultivar: plant.cultivar,
    plantType: plant.plantType,
    zoneMin: plant.zoneMin,
    zoneMax: plant.zoneMax,
    sunRequirements: plant.sunRequirements,
    waterNeeds: plant.waterNeeds,
    daysToMaturity: plant.daysToMaturity,
    spacingInches: plant.spacingInches,
    waterIntervalDays: plant.waterIntervalDays ?? null,
    fertilizeIntervalDays: plant.fertilizeIntervalDays ?? null,
    growingGuidance: plant.growingGuidance ?? null,
  };
  for (const field of MERGE_FIELDS) {
    const value = incoming[field];
    if (!isPresent(value)) continue;
    (row.values as Record<string, unknown>)[field] = value;
    row.fieldWinners[field] = sourceId;
  }
}

export function varietiesToDeprecate(
  previous: Array<{ varietyKey: string; sourceIds: string[] }>,
  mergedKeys: Set<string>,
  confirmingSourceIds: Set<string>,
): string[] {
  const out: string[] = [];
  for (const plant of previous) {
    if (mergedKeys.has(plant.varietyKey)) continue;
    if (plant.sourceIds.length === 0) continue;
    if (plant.sourceIds.every((id) => confirmingSourceIds.has(id))) {
      out.push(plant.varietyKey);
    }
  }
  return out;
}
