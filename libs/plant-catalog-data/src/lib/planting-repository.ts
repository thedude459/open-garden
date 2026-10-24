import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenBeds, gardenPlantingHarvests, gardenPlantings, plants } from './schema';

function visiblePlantings(gardenId: string) {
  return and(
    eq(gardenPlantings.gardenId, gardenId),
    sql`(
      ${gardenPlantings.life} <> 'annual'
      OR NOT EXISTS (
        SELECT 1 FROM garden_seasons
        WHERE garden_id = ${gardenPlantings.gardenId} AND status = 'open'
      )
      OR ${gardenPlantings.seasonYear} = (
        SELECT year FROM garden_seasons
        WHERE garden_id = ${gardenPlantings.gardenId} AND status = 'open'
        ORDER BY year DESC
        LIMIT 1
      )
    )`,
  );
}

export class PlantingRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const where = visiblePlantings(gardenId);

    const rows = await this.db
      .select({
        id: gardenPlantings.id,
        gardenId: gardenPlantings.gardenId,
        plantId: gardenPlantings.plantId,
        bedId: gardenPlantings.bedId,
        plantedOn: gardenPlantings.plantedOn,
        harvestedOn: gardenPlantings.harvestedOn,
        startMethod: gardenPlantings.startMethod,
        indoorStartedOn: gardenPlantings.indoorStartedOn,
        seasonYear: gardenPlantings.seasonYear,
        life: gardenPlantings.life,
        note: gardenPlantings.note,
        photo: gardenPlantings.photo,
        plantedYear: gardenPlantings.plantedYear,
        rootstock: gardenPlantings.rootstock,
        yearsToFruit: gardenPlantings.yearsToFruit,
        spacingFeet: gardenPlantings.spacingFeet,
        createdAt: gardenPlantings.createdAt,
        updatedAt: gardenPlantings.updatedAt,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(where)
      .orderBy(desc(gardenPlantings.createdAt), desc(gardenPlantings.id))
      .limit(pageSize)
      .offset(offset);

    const [total] = await this.db
      .select({ value: count() })
      .from(gardenPlantings)
      .where(where);

    return {
      items: rows,
      totalCount: Number(total?.value ?? 0),
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(gardenPlantings)
      .where(eq(gardenPlantings.id, id))
      .limit(1);
    return row ?? null;
  }

  async getInGarden(gardenId: string, id: string) {
    const [row] = await this.db
      .select({
        id: gardenPlantings.id,
        gardenId: gardenPlantings.gardenId,
        plantId: gardenPlantings.plantId,
        bedId: gardenPlantings.bedId,
        plantedOn: gardenPlantings.plantedOn,
        harvestedOn: gardenPlantings.harvestedOn,
        layoutXInches: gardenPlantings.layoutXInches,
        layoutYInches: gardenPlantings.layoutYInches,
        startMethod: gardenPlantings.startMethod,
        indoorStartedOn: gardenPlantings.indoorStartedOn,
        seasonYear: gardenPlantings.seasonYear,
        life: gardenPlantings.life,
        note: gardenPlantings.note,
        photo: gardenPlantings.photo,
        plantedYear: gardenPlantings.plantedYear,
        rootstock: gardenPlantings.rootstock,
        yearsToFruit: gardenPlantings.yearsToFruit,
        spacingFeet: gardenPlantings.spacingFeet,
        createdAt: gardenPlantings.createdAt,
        updatedAt: gardenPlantings.updatedAt,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
        spacingInches: plants.spacingInches,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .limit(1);
    return row ?? null;
  }

  async insert(input: {
    id?: string;
    gardenId: string;
    plantId: string;
    bedId: string | null;
    plantedOn: string | null;
    harvestedOn: string | null;
    startMethod?: string;
    indoorStartedOn?: string | null;
    clientMutationId?: string;
    life?: string;
    seasonYear?: number;
    note?: string | null;
    photo?: string | null;
    plantedYear?: number | null;
    rootstock?: string | null;
    yearsToFruit?: number | null;
    spacingFeet?: number | null;
  }) {
    const [row] = await this.db
      .insert(gardenPlantings)
      .values({
        id: input.id,
        gardenId: input.gardenId,
        plantId: input.plantId,
        bedId: input.bedId,
        plantedOn: input.plantedOn,
        harvestedOn: input.harvestedOn,
        startMethod: input.startMethod ?? 'direct_seed',
        indoorStartedOn: input.indoorStartedOn ?? null,
        clientMutationId: input.clientMutationId ?? null,
        life: input.life ?? 'annual',
        seasonYear: input.seasonYear ?? new Date().getUTCFullYear(),
        note: input.note ?? null,
        photo: input.photo || null,
        plantedYear: input.plantedYear ?? null,
        rootstock: input.rootstock ?? null,
        yearsToFruit: input.yearsToFruit ?? null,
        spacingFeet: input.spacingFeet ?? null,
      })
      .returning();
    if (input.harvestedOn) await this.rememberHarvest(row!.id, input.harvestedOn);
    return row!;
  }

  async update(
    gardenId: string,
    id: string,
    patch: {
      plantedOn?: string | null;
      harvestedOn?: string | null;
      bedId?: string | null;
      clientMutationId?: string;
      life?: string;
      note?: string | null;
      photo?: string | null;
      plantedYear?: number | null;
      rootstock?: string | null;
      yearsToFruit?: number | null;
      spacingFeet?: number | null;
    },
  ) {
    const [row] = await this.db
      .update(gardenPlantings)
      .set({
        updatedAt: new Date(),
        ...(patch.plantedOn !== undefined ? { plantedOn: patch.plantedOn } : {}),
        ...(patch.harvestedOn !== undefined ? { harvestedOn: patch.harvestedOn } : {}),
        ...(patch.bedId !== undefined ? { bedId: patch.bedId } : {}),
        ...(patch.clientMutationId !== undefined ? { clientMutationId: patch.clientMutationId } : {}),
        ...(patch.life !== undefined ? { life: patch.life } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.photo !== undefined ? { photo: patch.photo || null } : {}),
        ...(patch.plantedYear !== undefined ? { plantedYear: patch.plantedYear } : {}),
        ...(patch.rootstock !== undefined ? { rootstock: patch.rootstock } : {}),
        ...(patch.yearsToFruit !== undefined ? { yearsToFruit: patch.yearsToFruit } : {}),
        ...(patch.spacingFeet !== undefined ? { spacingFeet: patch.spacingFeet } : {}),
      })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning();
    if (row && patch.harvestedOn) await this.rememberHarvest(row.id, patch.harvestedOn);
    return row ?? null;
  }

  async delete(gardenId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(gardenPlantings)
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning({ id: gardenPlantings.id });
    return deleted.length > 0;
  }

  async listAllForLayout(gardenId: string) {
    return this.db
      .select({
        id: gardenPlantings.id,
        gardenId: gardenPlantings.gardenId,
        plantId: gardenPlantings.plantId,
        bedId: gardenPlantings.bedId,
        layoutXInches: gardenPlantings.layoutXInches,
        layoutYInches: gardenPlantings.layoutYInches,
        startMethod: gardenPlantings.startMethod,
        indoorStartedOn: gardenPlantings.indoorStartedOn,
        createdAt: gardenPlantings.createdAt,
        updatedAt: gardenPlantings.updatedAt,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
        spacingInches: plants.spacingInches,
        sunRequirements: plants.sunRequirements,
        life: gardenPlantings.life,
        spacingFeet: gardenPlantings.spacingFeet,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(visiblePlantings(gardenId))
      .orderBy(desc(gardenPlantings.createdAt), desc(gardenPlantings.id));
  }

  async setPlacement(
    gardenId: string,
    id: string,
    placement: { bedId: string; xInches: number; yInches: number },
  ) {
    const [row] = await this.db
      .update(gardenPlantings)
      .set({
        bedId: placement.bedId,
        layoutXInches: placement.xInches,
        layoutYInches: placement.yInches,
        updatedAt: new Date(),
      })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning();
    return row ?? null;
  }

  async clearLayoutCoords(gardenId: string, id: string) {
    const [row] = await this.db
      .update(gardenPlantings)
      .set({ layoutXInches: null, layoutYInches: null, updatedAt: new Date() })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning();
    return row ?? null;
  }

  async clearPlacement(gardenId: string, id: string) {
    const [row] = await this.db
      .update(gardenPlantings)
      .set({
        bedId: null,
        layoutXInches: null,
        layoutYInches: null,
        updatedAt: new Date(),
      })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning();
    return row ?? null;
  }

  async deleteDirectSeedInBed(gardenId: string, bedId: string) {
    await this.db
      .delete(gardenPlantings)
      .where(
        and(
          eq(gardenPlantings.gardenId, gardenId),
          eq(gardenPlantings.bedId, bedId),
          eq(gardenPlantings.startMethod, 'direct_seed'),
        ),
      );
  }

  async unassignTransplantsInBed(gardenId: string, bedId: string) {
    await this.db
      .update(gardenPlantings)
      .set({
        bedId: null,
        layoutXInches: null,
        layoutYInches: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gardenPlantings.gardenId, gardenId),
          eq(gardenPlantings.bedId, bedId),
          eq(gardenPlantings.startMethod, 'transplant'),
        ),
      );
  }

  async listUnplacedTransplants(gardenId: string) {
    return this.db
      .select({
        id: gardenPlantings.id,
        gardenId: gardenPlantings.gardenId,
        plantId: gardenPlantings.plantId,
        bedId: gardenPlantings.bedId,
        layoutXInches: gardenPlantings.layoutXInches,
        layoutYInches: gardenPlantings.layoutYInches,
        startMethod: gardenPlantings.startMethod,
        indoorStartedOn: gardenPlantings.indoorStartedOn,
        createdAt: gardenPlantings.createdAt,
        updatedAt: gardenPlantings.updatedAt,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
        spacingInches: plants.spacingInches,
        waterIntervalDays: plants.waterIntervalDays,
        fertilizeIntervalDays: plants.fertilizeIntervalDays,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .where(
        and(
          visiblePlantings(gardenId),
          eq(gardenPlantings.startMethod, 'transplant'),
          isNull(gardenPlantings.bedId),
        ),
      )
      .orderBy(desc(gardenPlantings.createdAt), desc(gardenPlantings.id));
  }

  async listAllForReminders(gardenId: string) {
    return this.db
      .select({
        id: gardenPlantings.id,
        plantId: gardenPlantings.plantId,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
        plantedOn: gardenPlantings.plantedOn,
        harvestedOn: gardenPlantings.harvestedOn,
        daysToMaturity: plants.daysToMaturity,
        waterIntervalDays: plants.waterIntervalDays,
        fertilizeIntervalDays: plants.fertilizeIntervalDays,
        bedId: gardenPlantings.bedId,
        bedName: gardenBeds.name,
      })
      .from(gardenPlantings)
      .innerJoin(plants, eq(gardenPlantings.plantId, plants.id))
      .leftJoin(gardenBeds, eq(gardenPlantings.bedId, gardenBeds.id))
      .where(visiblePlantings(gardenId))
      .orderBy(desc(gardenPlantings.createdAt), desc(gardenPlantings.id));
  }

  async clearLayoutForBed(gardenId: string, bedId: string) {
    await this.db
      .update(gardenPlantings)
      .set({ layoutXInches: null, layoutYInches: null, updatedAt: new Date() })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.bedId, bedId)));
  }

  async listHarvests(gardenId: string) {
    return this.db
      .select({
        plantingId: gardenPlantingHarvests.plantingId,
        harvestedOn: gardenPlantingHarvests.harvestedOn,
      })
      .from(gardenPlantingHarvests)
      .innerJoin(gardenPlantings, eq(gardenPlantingHarvests.plantingId, gardenPlantings.id))
      .where(eq(gardenPlantings.gardenId, gardenId));
  }

  async deleteHarvest(plantingId: string, harvestedOn: string) {
    await this.db
      .delete(gardenPlantingHarvests)
      .where(
        and(
          eq(gardenPlantingHarvests.plantingId, plantingId),
          eq(gardenPlantingHarvests.harvestedOn, harvestedOn),
        ),
      );
  }

  private async rememberHarvest(plantingId: string, harvestedOn: string) {
    await this.db
      .insert(gardenPlantingHarvests)
      .values({ plantingId, harvestedOn })
      .onConflictDoNothing();
  }
}

