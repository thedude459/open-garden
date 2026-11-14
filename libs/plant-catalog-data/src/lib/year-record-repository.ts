import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { CompanionPairDto, PriorCropDto, SeasonPlantingDto } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { CatalogCompanionRepository } from './catalog-companion-repository';
import { companionPairs, gardenBeds, gardenPlantings, gardenSeasons, plants } from './schema';

const otherPlant = alias(plants, 'companion_other');

export class YearRecordRepository {
  constructor(private readonly db: AppDatabase) {}

  async openYear(gardenId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ year: gardenSeasons.year })
      .from(gardenSeasons)
      .where(and(eq(gardenSeasons.gardenId, gardenId), eq(gardenSeasons.status, 'open')))
      .orderBy(desc(gardenSeasons.year))
      .limit(1);
    return row?.year ?? null;
  }

  async close(gardenId: string, now = new Date()) {
    const closedYear = (await this.openYear(gardenId)) ?? now.getUTCFullYear();
    const openYear = closedYear + 1;
    await this.db.transaction(async (tx) => {
      await tx
        .insert(gardenSeasons)
        .values({ gardenId, year: closedYear, status: 'closed', closedAt: now })
        .onConflictDoUpdate({
          target: [gardenSeasons.gardenId, gardenSeasons.year],
          set: { status: 'closed', closedAt: now },
        });
      await tx
        .insert(gardenSeasons)
        .values({ gardenId, year: openYear, status: 'open', closedAt: null })
        .onConflictDoUpdate({
          target: [gardenSeasons.gardenId, gardenSeasons.year],
          set: { status: 'open', closedAt: null },
        });
      await tx
        .update(gardenPlantings)
        .set({ seasonYear: openYear, updatedAt: now })
        .where(and(eq(gardenPlantings.gardenId, gardenId), ne(gardenPlantings.life, 'annual')));
    });
    return { closedYear, openYear };
  }

  async snapshot(gardenId: string) {
    const openYear = (await this.openYear(gardenId)) ?? new Date().getUTCFullYear();
    const [closed] = await this.db
      .select({ year: gardenSeasons.year })
      .from(gardenSeasons)
      .where(
        and(
          eq(gardenSeasons.gardenId, gardenId),
          eq(gardenSeasons.year, openYear - 1),
          eq(gardenSeasons.status, 'closed'),
        ),
      )
      .limit(1);
    const review = closed ? await this.rowsForYear(gardenId, closed.year) : [];
    const current = await this.rowsForYear(gardenId, openYear);
    const already = new Set(
      current.filter((row) => row.bedId).map((row) => `${row.bedId}:${row.plantId}`),
    );
    const seen = new Set<string>();
    const plantAgain = [];
    for (const row of review) {
      if (row.life !== 'annual' || !row.bedId || !row.bedName) continue;
      const key = `${row.bedId}:${row.plantId}`;
      if (seen.has(key) || already.has(key)) continue;
      seen.add(key);
      plantAgain.push({
        plantId: row.plantId,
        bedId: row.bedId,
        commonName: row.commonName,
        bedName: row.bedName,
      });
    }
    return {
      openYear,
      closedYear: closed?.year ?? null,
      review,
      plantAgain,
      pairs: await this.listPairs(gardenId),
      householdPlants: await this.householdPlants(gardenId),
    };
  }

  async layoutAdvice(
    gardenId: string,
  ): Promise<{ prior: PriorCropDto[]; pairs: CompanionPairDto[] }> {
    const openYear = (await this.openYear(gardenId)) ?? new Date().getUTCFullYear();
    const rows = await this.rowsForYear(gardenId, openYear - 1);
    const seen = new Set<string>();
    const prior: PriorCropDto[] = [];
    for (const row of rows) {
      if (row.life !== 'annual' || !row.bedId) continue;
      const key = `${row.bedId}:${row.plantId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      prior.push({
        bedId: row.bedId,
        plantId: row.plantId,
        commonName: row.commonName,
        family: row.family ?? null,
      });
    }
    const household = await this.listPairs(gardenId);
    return { prior, pairs: [...household, ...(await this.catalogPairs(gardenId, household))] };
  }

  /**
   * Dataset companion pairs between plants planted in this property, as
   * plant pairs the planner can show. A household pair for the same two
   * plants wins, whatever its kind (ADR 0030).
   */
  private async catalogPairs(
    gardenId: string,
    household: CompanionPairDto[],
  ): Promise<CompanionPairDto[]> {
    const planted = await this.db
      .selectDistinct({ id: plants.id, commonName: plants.commonName, cropId: plants.cropId })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(eq(gardenPlantings.gardenId, gardenId));
    const byCrop = new Map<string, Array<{ id: string; commonName: string }>>();
    for (const plant of planted) {
      if (!plant.cropId) continue;
      byCrop.set(plant.cropId, [...(byCrop.get(plant.cropId) ?? []), plant]);
    }
    if (byCrop.size === 0) return [];
    const key = (a: string, b: string) => [a, b].sort().join(':');
    const taken = new Set(household.map((pair) => key(pair.plantId, pair.otherPlantId)));
    const out: CompanionPairDto[] = [];
    for (const pair of await new CatalogCompanionRepository(this.db).listForCrops([
      ...byCrop.keys(),
    ])) {
      for (const plant of byCrop.get(pair.fromCropId) ?? []) {
        for (const other of byCrop.get(pair.cropId) ?? []) {
          const k = key(plant.id, other.id);
          if (plant.id === other.id || taken.has(k)) continue;
          taken.add(k);
          out.push({
            id: `catalog:${k}`,
            plantId: plant.id,
            otherPlantId: other.id,
            plantName: plant.commonName,
            otherName: other.commonName,
            kind: pair.kind,
            reason: pair.reason,
          });
        }
      }
    }
    return out;
  }

  async addPair(input: {
    gardenId: string;
    plantId: string;
    otherPlantId: string;
    kind: string;
    reason: string;
  }) {
    await this.db
      .insert(companionPairs)
      .values(input)
      .onConflictDoUpdate({
        target: [
          companionPairs.gardenId,
          companionPairs.plantId,
          companionPairs.otherPlantId,
          companionPairs.kind,
        ],
        set: { reason: input.reason },
      });
  }

  async listPairs(gardenId: string): Promise<CompanionPairDto[]> {
    const rows = await this.db
      .select({
        id: companionPairs.id,
        plantId: companionPairs.plantId,
        otherPlantId: companionPairs.otherPlantId,
        plantName: plants.commonName,
        otherName: otherPlant.commonName,
        kind: companionPairs.kind,
        reason: companionPairs.reason,
      })
      .from(companionPairs)
      .innerJoin(plants, eq(companionPairs.plantId, plants.id))
      .innerJoin(otherPlant, eq(companionPairs.otherPlantId, otherPlant.id))
      .where(eq(companionPairs.gardenId, gardenId))
      .orderBy(asc(plants.commonName));
    return rows.map((row) => ({
      ...row,
      kind: row.kind as CompanionPairDto['kind'],
    }));
  }

  private async householdPlants(gardenId: string) {
    return this.db
      .selectDistinct({ id: plants.id, commonName: plants.commonName })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(eq(gardenPlantings.gardenId, gardenId))
      .orderBy(asc(plants.commonName));
  }

  private async rowsForYear(gardenId: string, year: number): Promise<SeasonPlantingDto[]> {
    const rows = await this.db
      .select({
        id: gardenPlantings.id,
        plantId: gardenPlantings.plantId,
        commonName: plants.commonName,
        family: plants.family,
        bedId: gardenPlantings.bedId,
        bedName: gardenBeds.name,
        note: gardenPlantings.note,
        harvestedOn: gardenPlantings.harvestedOn,
        life: gardenPlantings.life,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .leftJoin(gardenBeds, eq(gardenPlantings.bedId, gardenBeds.id))
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.seasonYear, year)))
      .orderBy(asc(gardenBeds.name), asc(plants.commonName));
    return rows.map((row) => ({
      ...row,
      life: row.life as SeasonPlantingDto['life'],
    }));
  }
}
