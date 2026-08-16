import { and, count, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenPlantings, plants } from './schema';

export class PlantingRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const where = eq(gardenPlantings.gardenId, gardenId);

    const rows = await this.db
      .select({
        id: gardenPlantings.id,
        gardenId: gardenPlantings.gardenId,
        plantId: gardenPlantings.plantId,
        bedId: gardenPlantings.bedId,
        plantedOn: gardenPlantings.plantedOn,
        harvestedOn: gardenPlantings.harvestedOn,
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
    clientMutationId?: string;
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
        clientMutationId: input.clientMutationId ?? null,
      })
      .returning();
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
      })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning();
    return row ?? null;
  }

  async delete(gardenId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(gardenPlantings)
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.id, id)))
      .returning({ id: gardenPlantings.id });
    return deleted.length > 0;
  }
}
