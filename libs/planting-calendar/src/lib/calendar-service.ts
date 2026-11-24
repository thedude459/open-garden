import type {
  CalendarDto,
  CalendarEntryDto,
  CalendarWindowsDto,
  FrostRelativeWeeksDto,
  GardenRole,
  GrowingGuidanceDto,
  MonthDayDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';
import type {
  CalendarEntryRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingAreaRepository,
  PlantRepository,
} from '@open-garden/plant-catalog-data';
import { allowsPlant, homeFor, lifeForPlant } from '@open-garden/shared-types';
import { CALENDAR_ERRORS } from './domain-error';
import { overlapsThisWeek } from './this-week';
import {
  computeWindows,
  seasonYear as windowYear,
  sowingPlan,
  windowsAvailable,
  type SowingPlan,
  type WarmClimate,
} from './windows';

export class CalendarService {
  constructor(
    private readonly gardens: GardenRepository,
    private readonly memberships: GardenMembershipRepository,
    private readonly plants: PlantRepository,
    private readonly entries: CalendarEntryRepository,
    private readonly areas?: PlantingAreaRepository,
    /** The property's current season, for planning the next one (ADR 0040). */
    private readonly seasons?: { currentYear(gardenId: string): Promise<number> },
  ) {}

  /** The season asked for, which must be the current one or the next. */
  private async season(gardenId: string, seasonYear?: number) {
    const current = this.seasons
      ? await this.seasons.currentYear(gardenId)
      : new Date().getUTCFullYear();
    const year = seasonYear ?? current;
    if (year !== current && year !== current + 1) throw CALENDAR_ERRORS.seasonOutOfRange();
    return { year, current, query: year === current ? undefined : year };
  }

  async list(
    userId: string,
    gardenId: string,
    page = 1,
    pageSize = 100,
    today = new Date(),
    seasonYear?: number,
  ): Promise<CalendarDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw CALENDAR_ERRORS.gardenNotFound();
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw CALENDAR_ERRORS.gardenNotFound();

    const safePage = Math.max(1, page);
    const safeSize = Math.min(200, Math.max(1, pageSize));
    const lastFrost = pair(garden.lastFrostMonth, garden.lastFrostDay);
    const firstFrost = pair(garden.firstFrostMonth, garden.firstFrostDay);
    const monthlyMeanC = garden.monthlyMeanC ?? null;
    const available = windowsAvailable({ lastFrost, firstFrost }, monthlyMeanC);
    const season = await this.season(gardenId, seasonYear);
    // Next season's windows fall a year after this one's.
    const year = windowYear({ lastFrost, firstFrost }, today) + (season.year - season.current);
    const result = await this.entries.listByGarden(gardenId, safePage, safeSize, season.query);

    return {
      gardenId: garden.id,
      myRole: membership.role as GardenRole,
      windowsAvailable: available,
      hardinessZone: garden.hardinessZone,
      lastFrost,
      firstFrost,
      entries: result.items.map((row) =>
        toEntry(row, garden.hardinessZone, lastFrost, firstFrost, year, monthlyMeanC),
      ),
      seasonYear: season.year,
      currentSeasonYear: season.current,
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalCount,
    };
  }

  /**
   * A check for "can sow now" at a property the member belongs to: whether a
   * crop's indoor start, sowing, planting, or fall sowing window there is
   * open in the week from `asOf` (the member's local date).
   */
  async sowableNow(
    userId: string,
    gardenId: string,
    asOf: Date,
  ): Promise<(row: GuidanceRow) => boolean> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw CALENDAR_ERRORS.gardenNotFound();
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw CALENDAR_ERRORS.gardenNotFound();
    const frost = {
      lastFrost: pair(garden.lastFrostMonth, garden.lastFrostDay),
      firstFrost: pair(garden.firstFrostMonth, garden.firstFrostDay),
    };
    const monthlyMeanC = garden.monthlyMeanC ?? null;
    const year = windowYear(frost, asOf);
    return (row) => {
      const w = computeWindows(
        frost,
        guidanceFromRow(row),
        row.daysToMaturity,
        year,
        warmClimate(row, monthlyMeanC),
      );
      return overlapsThisWeek([w.indoorStart, w.outdoorSow, w.transplant, w.fallSow], asOf);
    };
  }

  /**
   * Where a sowing series of a crop may land at a property, for the season
   * of `firstSowOn` (ADR 0037). The caller has checked the member's access.
   * Null when the property or the crop is gone.
   */
  async sowingPlanFor(
    gardenId: string,
    plantId: string,
    startMethod: string,
    firstSowOn: string,
  ): Promise<SowingPlan | null> {
    const garden = await this.gardens.getById(gardenId);
    const plant = await this.plants.getById(plantId);
    if (!garden || !plant) return null;
    const frost = {
      lastFrost: pair(garden.lastFrostMonth, garden.lastFrostDay),
      firstFrost: pair(garden.firstFrostMonth, garden.firstFrostDay),
    };
    const [y, m, d] = firstSowOn.split('-').map(Number);
    return sowingPlan(
      frost,
      guidanceFromRow(plant),
      plant.daysToMaturity,
      plant.frostTolerance === 'tender',
      startMethod,
      windowYear(frost, new Date(y!, m! - 1, d)),
      warmClimate(plant, garden.monthlyMeanC ?? null),
    );
  }

  /**
   * Plans a crop for the season (ADR 0040): a planting with no bed and no
   * date, which Bed View offers to place. A crop already planned or planted
   * there is left as it is.
   */
  async add(
    userId: string,
    gardenId: string,
    plantId: string,
    seasonYear?: number,
  ): Promise<{ created: boolean; calendar: CalendarDto }> {
    await this.requireEditor(userId, gardenId);
    const plant = await this.plants.getById(plantId);
    if (!plant) throw CALENDAR_ERRORS.plantNotFound();
    // A property takes a plant when one of its areas does; vegetable is implied.
    if (this.areas && !allowsPlant('vegetable', plant.plantType)) {
      const home = homeFor(plant.plantType);
      if (!(await this.areas.hasKind(gardenId, home))) throw CALENDAR_ERRORS.areaRequired(home);
    }
    const season = await this.season(gardenId, seasonYear);
    const { created } = await this.entries.addPlanned(
      gardenId,
      plantId,
      lifeForPlant(plant.plantType, null, plant.perennial),
      season.query,
    );
    const calendar = await this.list(userId, gardenId, 1, 100, new Date(), seasonYear);
    return { created, calendar };
  }

  /** Takes a crop's unplaced, planned plantings off the season. */
  async remove(
    userId: string,
    gardenId: string,
    plantId: string,
    seasonYear?: number,
  ): Promise<void> {
    await this.requireEditor(userId, gardenId);
    const season = await this.season(gardenId, seasonYear);
    await this.entries.removePlanned(gardenId, plantId, season.query);
  }

  private async requireEditor(userId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw CALENDAR_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw CALENDAR_ERRORS.viewerForbidden();
  }
}

/** A crop's sowing guidance as the catalog stores it. */
type GuidanceRow = {
  daysToMaturity: number | null;
  indoorFrostAnchor: string | null;
  indoorWeeksEarliest: number | null;
  indoorWeeksLatest: number | null;
  sowFrostAnchor: string | null;
  sowWeeksEarliest: number | null;
  sowWeeksLatest: number | null;
  transplantFrostAnchor: string | null;
  transplantWeeksEarliest: number | null;
  transplantWeeksLatest: number | null;
  fallSowWeeksEarliest?: number | null;
  fallSowWeeksLatest?: number | null;
  growMinC?: number | null;
  growMaxC?: number | null;
  sowSoilMinC?: number | null;
};

type EntryRow = GuidanceRow & {
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: string;
  status: string;
  zoneMin: number;
  zoneMax: number;
  planned?: boolean;
  planted?: boolean;
};

function toEntry(
  row: EntryRow,
  gardenZone: number | null,
  lastFrost: MonthDayDto | null,
  firstFrost: MonthDayDto | null,
  year: number,
  monthlyMeanC: number[] | null,
): CalendarEntryDto {
  const guidance = guidanceFromRow(row);
  const windows: CalendarWindowsDto = computeWindows(
    { lastFrost, firstFrost },
    guidance,
    row.daysToMaturity,
    year,
    warmClimate(row, monthlyMeanC),
  );
  return {
    plantId: row.plantId,
    commonName: row.commonName,
    species: row.species,
    cultivar: row.cultivar,
    plantType: row.plantType as PlantType,
    status: row.status as PlantStatus,
    zoneMin: row.zoneMin,
    zoneMax: row.zoneMax,
    zoneMismatch: zoneMismatch(gardenZone, row.zoneMin, row.zoneMax),
    windows,
    planned: row.planned ?? true,
    planted: row.planted ?? false,
  };
}

function warmClimate(row: GuidanceRow, monthlyMeanC: number[] | null): WarmClimate {
  const sowingTemperature =
    row.growMinC != null && row.growMaxC != null
      ? { minC: row.growMinC, maxC: row.growMaxC, minSoilC: row.sowSoilMinC ?? null }
      : null;
  return { monthlyMeanC, sowingTemperature };
}

function guidanceFromRow(row: GuidanceRow): GrowingGuidanceDto {
  return {
    indoorStart: triplet(row.indoorFrostAnchor, row.indoorWeeksEarliest, row.indoorWeeksLatest),
    outdoorSow: triplet(row.sowFrostAnchor, row.sowWeeksEarliest, row.sowWeeksLatest),
    transplant: triplet(
      row.transplantFrostAnchor,
      row.transplantWeeksEarliest,
      row.transplantWeeksLatest,
    ),
    fallSow: triplet('first', row.fallSowWeeksEarliest ?? null, row.fallSowWeeksLatest ?? null),
  };
}

function triplet(
  anchor: string | null,
  earliest: number | null,
  latest: number | null,
): FrostRelativeWeeksDto | null {
  if (anchor !== 'last' && anchor !== 'first') return null;
  if (earliest == null || latest == null) return null;
  return { frostAnchor: anchor, weeksEarliest: earliest, weeksLatest: latest };
}

function zoneMismatch(gardenZone: number | null, zoneMin: number, zoneMax: number): boolean | null {
  if (gardenZone == null) return null;
  return !(zoneMin <= gardenZone && gardenZone <= zoneMax);
}

function pair(month: number | null, day: number | null): MonthDayDto | null {
  if (month == null || day == null) return null;
  return { month, day };
}
