import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenNonPlantingAreas } from './schema';

export class AreaRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string) {
    return this.db
      .select()
      .from(gardenNonPlantingAreas)
      .where(eq(gardenNonPlantingAreas.gardenId, gardenId))
      .orderBy(asc(gardenNonPlantingAreas.name));
  }

  async getInGarden(gardenId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(gardenNonPlantingAreas)
      .where(and(eq(gardenNonPlantingAreas.gardenId, gardenId), eq(gardenNonPlantingAreas.id, id)))
      .limit(1);
    return row ?? null;
  }

  async findByNormalizedName(gardenId: string, nameNormalized: string) {
    const [row] = await this.db
      .select()
      .from(gardenNonPlantingAreas)
      .where(
        and(
          eq(gardenNonPlantingAreas.gardenId, gardenId),
          eq(gardenNonPlantingAreas.nameNormalized, nameNormalized),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsert(
    gardenId: string,
    input: {
      id: string;
      name: string;
      nameNormalized: string;
      originXInches: number;
      originYInches: number;
      lengthInches: number;
      widthInches: number;
    },
  ) {
    const existing = await this.getInGarden(gardenId, input.id);
    if (existing) {
      const [row] = await this.db
        .update(gardenNonPlantingAreas)
        .set({
          name: input.name,
          nameNormalized: input.nameNormalized,
          originXInches: input.originXInches,
          originYInches: input.originYInches,
          lengthInches: input.lengthInches,
          widthInches: input.widthInches,
          updatedAt: new Date(),
        })
        .where(
          and(eq(gardenNonPlantingAreas.gardenId, gardenId), eq(gardenNonPlantingAreas.id, input.id)),
        )
        .returning();
      return row!;
    }
    const [row] = await this.db
      .insert(gardenNonPlantingAreas)
      .values({
        id: input.id,
        gardenId,
        name: input.name,
        nameNormalized: input.nameNormalized,
        originXInches: input.originXInches,
        originYInches: input.originYInches,
        lengthInches: input.lengthInches,
        widthInches: input.widthInches,
      })
      .returning();
    return row!;
  }

  async delete(gardenId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(gardenNonPlantingAreas)
      .where(and(eq(gardenNonPlantingAreas.gardenId, gardenId), eq(gardenNonPlantingAreas.id, id)))
      .returning({ id: gardenNonPlantingAreas.id });
    return deleted.length > 0;
  }
}
