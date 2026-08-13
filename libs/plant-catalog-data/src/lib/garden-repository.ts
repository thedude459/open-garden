import { and, asc, count, eq, ne } from 'drizzle-orm';
import type { GardenRole } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenMemberships, gardens } from './schema';

export interface GardenInsert {
  ownerId: string;
  name: string;
  nameNormalized: string;
  notes: string | null;
  hardinessZone: number | null;
  lastFrostMonth: number | null;
  lastFrostDay: number | null;
  firstFrostMonth: number | null;
  firstFrostDay: number | null;
}

export interface GardenUpdate {
  name?: string;
  nameNormalized?: string;
  notes?: string | null;
  hardinessZone?: number | null;
  lastFrostMonth?: number | null;
  lastFrostDay?: number | null;
  firstFrostMonth?: number | null;
  firstFrostDay?: number | null;
  ownerId?: string;
}

export class GardenRepository {
  constructor(private readonly db: AppDatabase) {}

  async createOwned(input: GardenInsert) {
    return this.db.transaction(async (tx) => {
      const [garden] = await tx.insert(gardens).values(input).returning();
      if (!garden) throw new Error('Failed to create garden');
      await tx.insert(gardenMemberships).values({
        gardenId: garden.id,
        userId: input.ownerId,
        role: 'owner',
      });
      return garden;
    });
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(gardens).where(eq(gardens.id, id)).limit(1);
    return row ?? null;
  }

  async findOwnedByNormalizedName(ownerId: string, nameNormalized: string, excludeId?: string) {
    const where = excludeId
      ? and(
          eq(gardens.ownerId, ownerId),
          eq(gardens.nameNormalized, nameNormalized),
          ne(gardens.id, excludeId),
        )
      : and(eq(gardens.ownerId, ownerId), eq(gardens.nameNormalized, nameNormalized));
    const [row] = await this.db.select().from(gardens).where(where).limit(1);
    return row ?? null;
  }

  async listForUser(userId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        garden: gardens,
        myRole: gardenMemberships.role,
      })
      .from(gardenMemberships)
      .innerJoin(gardens, eq(gardenMemberships.gardenId, gardens.id))
      .where(eq(gardenMemberships.userId, userId))
      .orderBy(asc(gardens.name))
      .limit(pageSize)
      .offset(offset);

    const [total] = await this.db
      .select({ value: count() })
      .from(gardenMemberships)
      .where(eq(gardenMemberships.userId, userId));

    return {
      items: rows.map((r) => ({ ...r.garden, myRole: r.myRole as GardenRole })),
      totalCount: Number(total?.value ?? 0),
      page,
      pageSize,
    };
  }

  async update(id: string, patch: GardenUpdate) {
    const [row] = await this.db
      .update(gardens)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(gardens.id, id))
      .returning();
    return row ?? null;
  }

  async hardDelete(id: string) {
    await this.db.delete(gardens).where(eq(gardens.id, id));
  }
}
