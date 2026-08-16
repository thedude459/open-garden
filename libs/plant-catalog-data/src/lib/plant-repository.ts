import { and, asc, count, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type { GrowingGuidanceDto, PlantType } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { plants } from './schema';

export interface PlantUpsertInput {
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
  provider: string | null;
  providerExternalId: string | null;
  growingGuidance?: GrowingGuidanceDto | null;
}

export interface PlantListFilters {
  q?: string;
  zone?: number;
  plantType?: PlantType;
  page: number;
  pageSize: number;
  includeDeprecated?: boolean;
}

export class PlantRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsertByVarietyKey(input: PlantUpsertInput) {
    const guidance = flattenGuidance(input.growingGuidance);
    const [row] = await this.db
      .insert(plants)
      .values({
        varietyKey: input.varietyKey,
        commonName: input.commonName,
        species: input.species,
        cultivar: input.cultivar,
        plantType: input.plantType,
        zoneMin: input.zoneMin,
        zoneMax: input.zoneMax,
        sunRequirements: input.sunRequirements,
        waterNeeds: input.waterNeeds,
        daysToMaturity: input.daysToMaturity,
        spacingInches: input.spacingInches,
        provider: input.provider,
        providerExternalId: input.providerExternalId,
        status: 'active',
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        ...guidance,
      })
      .onConflictDoUpdate({
        target: plants.varietyKey,
        set: {
          commonName: input.commonName,
          species: input.species,
          cultivar: input.cultivar,
          plantType: input.plantType,
          zoneMin: input.zoneMin,
          zoneMax: input.zoneMax,
          sunRequirements: input.sunRequirements,
          waterNeeds: input.waterNeeds,
          daysToMaturity: input.daysToMaturity,
          spacingInches: input.spacingInches,
          provider: input.provider,
          providerExternalId: input.providerExternalId,
          status: 'active',
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
          ...guidance,
        },
      })
      .returning();
    return row;
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(plants).where(eq(plants.id, id)).limit(1);
    return row ?? null;
  }

  async list(filters: PlantListFilters) {
    const conditions: SQL[] = [];
    if (!filters.includeDeprecated) {
      conditions.push(eq(plants.status, 'active'));
    }
    if (filters.plantType) {
      conditions.push(eq(plants.plantType, filters.plantType));
    }
    if (filters.zone !== undefined) {
      conditions.push(lte(plants.zoneMin, filters.zone));
      conditions.push(gte(plants.zoneMax, filters.zone));
    }
    if (filters.q && filters.q.trim().length > 0) {
      const pattern = `%${escapeLike(filters.q.trim())}%`;
      conditions.push(
        or(
          ilike(plants.commonName, pattern),
          ilike(plants.species, pattern),
          ilike(plants.cultivar, pattern),
        ) as SQL,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.pageSize;

    const items = await this.db
      .select()
      .from(plants)
      .where(where)
      .orderBy(asc(plants.commonName))
      .limit(filters.pageSize)
      .offset(offset);

    const [total] = await this.db.select({ value: count() }).from(plants).where(where);

    return {
      items,
      totalCount: Number(total?.value ?? 0),
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
}

function flattenGuidance(guidance: GrowingGuidanceDto | null | undefined) {
  const indoor = sanitizeWindow(guidance?.indoorStart);
  const sow = sanitizeWindow(guidance?.outdoorSow);
  const transplant = sanitizeWindow(guidance?.transplant);
  return {
    indoorFrostAnchor: indoor?.frostAnchor ?? null,
    indoorWeeksEarliest: indoor?.weeksEarliest ?? null,
    indoorWeeksLatest: indoor?.weeksLatest ?? null,
    sowFrostAnchor: sow?.frostAnchor ?? null,
    sowWeeksEarliest: sow?.weeksEarliest ?? null,
    sowWeeksLatest: sow?.weeksLatest ?? null,
    transplantFrostAnchor: transplant?.frostAnchor ?? null,
    transplantWeeksEarliest: transplant?.weeksEarliest ?? null,
    transplantWeeksLatest: transplant?.weeksLatest ?? null,
  };
}

function sanitizeWindow(
  window: GrowingGuidanceDto['indoorStart'] | undefined,
): GrowingGuidanceDto['indoorStart'] {
  if (!window) return null;
  const { frostAnchor, weeksEarliest, weeksLatest } = window;
  if (frostAnchor !== 'last' && frostAnchor !== 'first') return null;
  if (!Number.isInteger(weeksEarliest) || !Number.isInteger(weeksLatest)) return null;
  if (Math.abs(weeksEarliest) > 52 || Math.abs(weeksLatest) > 52) return null;
  if (weeksEarliest > weeksLatest) return null;
  return { frostAnchor, weeksEarliest, weeksLatest };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
