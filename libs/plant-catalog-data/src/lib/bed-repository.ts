import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenBeds, gardenPlantings } from './schema';

export class BedRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string) {
    return this.db
      .select()
      .from(gardenBeds)
      .where(eq(gardenBeds.gardenId, gardenId))
      .orderBy(asc(gardenBeds.name));
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(gardenBeds).where(eq(gardenBeds.id, id)).limit(1);
    return row ?? null;
  }

  async getInGarden(gardenId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(gardenBeds)
      .where(and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.id, id)))
      .limit(1);
    return row ?? null;
  }

  async findByNormalizedName(gardenId: string, nameNormalized: string) {
    const [row] = await this.db
      .select()
      .from(gardenBeds)
      .where(
        and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.nameNormalized, nameNormalized)),
      )
      .limit(1);
    return row ?? null;
  }

  async insert(input: {
    id?: string;
    gardenId: string;
    name: string;
    nameNormalized: string;
  }) {
    const [row] = await this.db
      .insert(gardenBeds)
      .values({
        id: input.id,
        gardenId: input.gardenId,
        name: input.name,
        nameNormalized: input.nameNormalized,
      })
      .returning();
    return row!;
  }

  async rename(gardenId: string, id: string, name: string, nameNormalized: string) {
    const [row] = await this.db
      .update(gardenBeds)
      .set({ name, nameNormalized, updatedAt: new Date() })
      .where(and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.id, id)))
      .returning();
    return row ?? null;
  }

  async setGeometry(
    gardenId: string,
    id: string,
    geometry: {
      originXInches: number;
      originYInches: number;
      lengthInches: number;
      widthInches: number;
      orientation: number;
    },
  ) {
    const [row] = await this.db
      .update(gardenBeds)
      .set({
        originXInches: geometry.originXInches,
        originYInches: geometry.originYInches,
        lengthInches: geometry.lengthInches,
        widthInches: geometry.widthInches,
        orientation: geometry.orientation,
        updatedAt: new Date(),
      })
      .where(and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.id, id)))
      .returning();
    return row ?? null;
  }

  async clearGeometry(gardenId: string, id: string) {
    const [row] = await this.db
      .update(gardenBeds)
      .set({
        originXInches: null,
        originYInches: null,
        lengthInches: null,
        widthInches: null,
        orientation: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.id, id)))
      .returning();
    return row ?? null;
  }

  async delete(gardenId: string, id: string): Promise<boolean> {
    await this.db
      .update(gardenPlantings)
      .set({ layoutXInches: null, layoutYInches: null, updatedAt: new Date() })
      .where(and(eq(gardenPlantings.gardenId, gardenId), eq(gardenPlantings.bedId, id)));
    const deleted = await this.db
      .delete(gardenBeds)
      .where(and(eq(gardenBeds.gardenId, gardenId), eq(gardenBeds.id, id)))
      .returning({ id: gardenBeds.id });
    return deleted.length > 0;
  }
}

