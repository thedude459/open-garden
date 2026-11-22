import { and, asc, count, eq, exists, isNotNull, isNull, or } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { PlantingRepository, visiblePlantings } from './planting-repository';
import { gardenPlantings, plants } from './schema';

/**
 * The calendar (ADR 0040): one row per crop with a planting in the season,
 * planned or planted. Adding a crop adds a planned planting; there is no
 * separate list. `seasonYear` undefined is the current season.
 */
export class CalendarEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByGarden(gardenId: string, page: number, pageSize: number, seasonYear?: number) {
    const offset = (page - 1) * pageSize;
    const ofCrop = (only?: ReturnType<typeof isNull>) =>
      this.db
        .select({ one: gardenPlantings.plantId })
        .from(gardenPlantings)
        .where(
          and(visiblePlantings(gardenId, seasonYear), eq(gardenPlantings.plantId, plants.id), only),
        );
    const planned = ofCrop(isNull(gardenPlantings.plantedOn));
    const planted = ofCrop(isNotNull(gardenPlantings.plantedOn));
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
        fallSowWeeksEarliest: plants.fallSowWeeksEarliest,
        fallSowWeeksLatest: plants.fallSowWeeksLatest,
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

  /**
   * Plans a crop for the season: a planting with no bed and no date, unless
   * the crop already has one there. ponytail: two adds at the same moment
   * can both insert; the second is an extra planned planting to remove.
   */
  async addPlanned(
    gardenId: string,
    plantId: string,
    life: 'annual' | 'perennial' | 'tree',
    seasonYear?: number,
  ): Promise<{ created: boolean }> {
    const [existing] = await this.db
      .select({ id: gardenPlantings.id })
      .from(gardenPlantings)
      .where(and(visiblePlantings(gardenId, seasonYear), eq(gardenPlantings.plantId, plantId)))
      .limit(1);
    if (existing) return { created: false };
    await new PlantingRepository(this.db).insert({
      gardenId,
      plantId,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
      life,
      seasonYear,
    });
    return { created: true };
  }

  /**
   * Takes a crop off the season's calendar: its planned plantings that are
   * not in a bed or tray. One in the ground, or placed, stays, and so does
   * the crop's row.
   */
  async removePlanned(gardenId: string, plantId: string, seasonYear?: number): Promise<void> {
    await this.db
      .delete(gardenPlantings)
      .where(
        and(
          visiblePlantings(gardenId, seasonYear),
          eq(gardenPlantings.plantId, plantId),
          isNull(gardenPlantings.plantedOn),
          isNull(gardenPlantings.harvestedOn),
          isNull(gardenPlantings.bedId),
          isNull(gardenPlantings.trayId),
        ),
      );
  }
}
