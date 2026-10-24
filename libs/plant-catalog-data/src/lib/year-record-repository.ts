import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { CompanionPairDto, PriorCropDto, SeasonPlantingDto } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
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

  async layoutAdvice(gardenId: string): Promise<{ prior: PriorCropDto[]; pairs: CompanionPairDto[] }> {
    const openYear = (await this.openYear(gardenId)) ?? new Date().getUTCFullYear();
    const rows = await this.rowsForYear(gardenId, openYear - 1);
    const seen = new Set<string>();
    const prior: PriorCropDto[] = [];
    for (const row of rows) {
      if (row.life !== 'annual' || !row.bedId) continue;
      const key = `${row.bedId}:${row.plantId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      prior.push({ bedId: row.bedId, plantId: row.plantId, commonName: row.commonName });
    }
    return { prior, pairs: await this.listPairs(gardenId) };
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
