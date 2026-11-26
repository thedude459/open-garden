import { and, asc, count, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import type { GardenRole } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenBeds, gardenMemberships, gardenPlantings, gardens } from './schema';

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
  monthlyMeanC: number[] | null;
  lateLastFrostMonth?: number | null;
  lateLastFrostDay?: number | null;
  earlyFirstFrostMonth?: number | null;
  earlyFirstFrostDay?: number | null;
  lengthInches: number;
  widthInches: number;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
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
  monthlyMeanC?: number[] | null;
  lateLastFrostMonth?: number | null;
  lateLastFrostDay?: number | null;
  earlyFirstFrostMonth?: number | null;
  earlyFirstFrostDay?: number | null;
  lengthInches?: number;
  widthInches?: number;
  ownerId?: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
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

  /** Country and hardiness zone of every property the member belongs to. */
  async placesForUser(
    userId: string,
  ): Promise<Array<{ country: string | null; zone: number | null }>> {
    return this.db
      .selectDistinct({ country: gardens.countryCode, zone: gardens.hardinessZone })
      .from(gardenMemberships)
      .innerJoin(gardens, eq(gardenMemberships.gardenId, gardens.id))
      .where(eq(gardenMemberships.userId, userId));
  }

  /** The hardiness zones of every property the member belongs to that has one. */
  async zonesForUser(userId: string): Promise<number[]> {
    const rows = await this.db
      .selectDistinct({ zone: gardens.hardinessZone })
      .from(gardenMemberships)
      .innerJoin(gardens, eq(gardenMemberships.gardenId, gardens.id))
      .where(eq(gardenMemberships.userId, userId));
    return rows.flatMap((row) => (row.zone == null ? [] : [row.zone]));
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

  /**
   * Bed and plant counts per property, and each sized bed's outline (turned
   * as drawn), for the property list: one query each, however many properties.
   */
  async countsForGardenIds(ids: string[]): Promise<
    Map<
      string,
      {
        bedCount: number;
        placementCount: number;
        beds: { x: number; y: number; w: number; h: number }[];
      }
    >
  > {
    const map = new Map<
      string,
      {
        bedCount: number;
        placementCount: number;
        beds: { x: number; y: number; w: number; h: number }[];
      }
    >();
    if (ids.length === 0) return map;
    for (const id of ids) {
      map.set(id, { bedCount: 0, placementCount: 0, beds: [] });
    }

    const bedRows = await this.db
      .select({
        gardenId: gardenBeds.gardenId,
        x: gardenBeds.originXInches,
        y: gardenBeds.originYInches,
        length: gardenBeds.lengthInches,
        width: gardenBeds.widthInches,
        orientation: gardenBeds.orientation,
      })
      .from(gardenBeds)
      .where(inArray(gardenBeds.gardenId, ids));

    const placementRows = await this.db
      .select({ gardenId: gardenPlantings.gardenId, n: count() })
      .from(gardenPlantings)
      .where(
        and(
          inArray(gardenPlantings.gardenId, ids),
          isNotNull(gardenPlantings.bedId),
          isNotNull(gardenPlantings.layoutXInches),
          isNotNull(gardenPlantings.layoutYInches),
        ),
      )
      .groupBy(gardenPlantings.gardenId);

    for (const row of bedRows) {
      const cur = map.get(row.gardenId);
      if (!cur) continue;
      cur.bedCount += 1;
      if (row.x == null || row.y == null || row.length == null || row.width == null) continue;
      const turned = row.orientation === 90 || row.orientation === 270;
      cur.beds.push({
        x: row.x,
        y: row.y,
        w: turned ? row.width : row.length,
        h: turned ? row.length : row.width,
      });
    }
    for (const row of placementRows) {
      const cur = map.get(row.gardenId);
      if (cur) cur.placementCount = Number(row.n);
    }
    return map;
  }

  async transferOwner(gardenId: string, fromUserId: string, toUserId: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(gardenMemberships)
        .set({ role: 'collaborator' })
        .where(
          and(eq(gardenMemberships.gardenId, gardenId), eq(gardenMemberships.userId, fromUserId)),
        );
      await tx
        .update(gardenMemberships)
        .set({ role: 'owner' })
        .where(
          and(eq(gardenMemberships.gardenId, gardenId), eq(gardenMemberships.userId, toUserId)),
        );
      const [garden] = await tx
        .update(gardens)
        .set({ ownerId: toUserId, updatedAt: new Date() })
        .where(eq(gardens.id, gardenId))
        .returning();
      return garden ?? null;
    });
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
