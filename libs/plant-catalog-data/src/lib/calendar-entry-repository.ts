import { and, asc, count, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { gardenCalendarEntries, plants } from './schema';

export class CalendarEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const where = eq(gardenCalendarEntries.gardenId, gardenId);

    const rows = await this.db
      .select({
        plantId: plants.id,
        commonName: plants.commonName,
        species: plants.species,
        cultivar: plants.cultivar,
        plantType: plants.plantType,
        status: plants.status,
        zoneMin: plants.zoneMin,
        zoneMax: plants.zoneMax,
        daysToMaturity: plants.daysToMaturity,
        indoorFrostAnchor: plants.indoorFrostAnchor,
        indoorWeeksEarliest: plants.indoorWeeksEarliest,
        indoorWeeksLatest: plants.indoorWeeksLatest,
        sowFrostAnchor: plants.sowFrostAnchor,
        sowWeeksEarliest: plants.sowWeeksEarliest,
        sowWeeksLatest: plants.sowWeeksLatest,
        transplantFrostAnchor: plants.transplantFrostAnchor,
        transplantWeeksEarliest: plants.transplantWeeksEarliest,
        transplantWeeksLatest: plants.transplantWeeksLatest,
      })
      .from(gardenCalendarEntries)
      .innerJoin(plants, eq(gardenCalendarEntries.plantId, plants.id))
      .where(where)
      .orderBy(asc(plants.commonName))
      .limit(pageSize)
      .offset(offset);

    const [total] = await this.db
      .select({ value: count() })
      .from(gardenCalendarEntries)
      .where(where);

    return {
      items: rows,
      totalCount: Number(total?.value ?? 0),
      page,
      pageSize,
    };
  }

  async insert(gardenId: string, plantId: string): Promise<{ created: boolean }> {
    const [row] = await this.db
      .insert(gardenCalendarEntries)
      .values({ gardenId, plantId })
      .onConflictDoNothing({
        target: [gardenCalendarEntries.gardenId, gardenCalendarEntries.plantId],
      })
      .returning();
    return { created: Boolean(row) };
  }

  async delete(gardenId: string, plantId: string): Promise<void> {
    await this.db
      .delete(gardenCalendarEntries)
      .where(
        and(eq(gardenCalendarEntries.gardenId, gardenId), eq(gardenCalendarEntries.plantId, plantId)),
      );
  }
}
