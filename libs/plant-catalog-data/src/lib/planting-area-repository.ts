import { and, asc, eq } from 'drizzle-orm';
import type { AreaKind } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenAreas } from './schema';

const AREA_NAMES: Record<AreaKind, string> = {
  vegetable: 'Vegetable garden',
  orchard: 'Orchard',
  greenhouse: 'Greenhouse',
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export class PlantingAreaRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string) {
    return this.db
      .select()
      .from(gardenAreas)
      .where(eq(gardenAreas.gardenId, gardenId))
      .orderBy(asc(gardenAreas.name));
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(gardenAreas).where(eq(gardenAreas.id, id)).limit(1);
    return row ?? null;
  }

  async getInGarden(gardenId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(gardenAreas)
      .where(and(eq(gardenAreas.gardenId, gardenId), eq(gardenAreas.id, id)))
      .limit(1);
    return row ?? null;
  }

  async findByKind(gardenId: string, kind: AreaKind) {
    const [row] = await this.db
      .select()
      .from(gardenAreas)
      .where(and(eq(gardenAreas.gardenId, gardenId), eq(gardenAreas.kind, kind)))
      .limit(1);
    return row ?? null;
  }

  async hasKind(gardenId: string, kind: AreaKind) {
    return (await this.findByKind(gardenId, kind)) !== null;
  }

  /** First area of this kind, or the default name when the property has none. */
  async ensure(gardenId: string, kind: AreaKind) {
    const found = await this.findByKind(gardenId, kind);
    if (found) return found;
    return this.insert(gardenId, AREA_NAMES[kind], kind);
  }

  /** Another area of this kind. The first one uses the default name. */
  async add(gardenId: string, kind: AreaKind) {
    const rows = await this.listByGarden(gardenId);
    const count = rows.filter((row) => row.kind === kind).length;
    const base = AREA_NAMES[kind];
    return this.insert(gardenId, count === 0 ? base : `${base} ${count + 1}`, kind);
  }

  private async insert(gardenId: string, name: string, kind: AreaKind) {
    const [row] = await this.db
      .insert(gardenAreas)
      .values({
        gardenId,
        name,
        nameNormalized: normalizeName(name),
        kind,
      })
      .returning();
    return row!;
  }
}
