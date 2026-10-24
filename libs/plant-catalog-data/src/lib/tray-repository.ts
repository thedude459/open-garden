import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenTrays } from './schema';

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export class TrayRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string) {
    return this.db
      .select()
      .from(gardenTrays)
      .where(eq(gardenTrays.gardenId, gardenId))
      .orderBy(asc(gardenTrays.name));
  }

  async getInGarden(gardenId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(gardenTrays)
      .where(and(eq(gardenTrays.gardenId, gardenId), eq(gardenTrays.id, id)))
      .limit(1);
    return row ?? null;
  }

  async findByName(areaId: string, nameNormalized: string) {
    const [row] = await this.db
      .select()
      .from(gardenTrays)
      .where(and(eq(gardenTrays.areaId, areaId), eq(gardenTrays.nameNormalized, nameNormalized)))
      .limit(1);
    return row ?? null;
  }

  /** Same name in a greenhouse returns the tray already there. */
  async open(gardenId: string, areaId: string, name: string) {
    const trimmed = name.trim();
    const found = await this.findByName(areaId, normalizeName(trimmed));
    if (found) return found;
    const [row] = await this.db
      .insert(gardenTrays)
      .values({
        gardenId,
        areaId,
        name: trimmed,
        nameNormalized: normalizeName(trimmed),
      })
      .returning();
    return row!;
  }
}
