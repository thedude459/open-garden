import { and, asc, count, eq, exists, or } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { visiblePlantings } from './planting-repository';
import { gardenCalendarEntries, gardenPlantings, plants } from './schema';

export class CalendarEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * The calendar: crops on the household's plan, and crops planted this
   * season (so placing a plant in a bed puts it on the calendar).
   */
  async listByGarden(gardenId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const planned = this.db
      .select({ one: gardenCalendarEntries.plantId })
      .from(gardenCalendarEntries)
      .where(
        and(
          eq(gardenCalendarEntries.gardenId, gardenId),
          eq(gardenCalendarEntries.plantId, plants.id),
        ),
      );
    const planted = this.db
      .select({ one: gardenPlantings.plantId })
      .from(gardenPlantings)
      .where(and(visiblePlantings(gardenId), eq(gardenPlantings.plantId, plants.id)));
    const where = or(exists(planned), exists(planted));

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
        growMinC: plants.growMinC,
        growMaxC: plants.growMaxC,
        sowSoilMinC: plants.sowSoilMinC,
        planned: exists(planned).mapWith(Boolean),
        planted: exists(planted).mapWith(Boolean),
      })
      .from(plants)
      .where(where)
      .orderBy(asc(plants.commonName))
      .limit(pageSize)
      .offset(offset);

    const [total] = await this.db.select({ value: count() }).from(plants).where(where);

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
        and(
          eq(gardenCalendarEntries.gardenId, gardenId),
          eq(gardenCalendarEntries.plantId, plantId),
        ),
      );
  }
}
