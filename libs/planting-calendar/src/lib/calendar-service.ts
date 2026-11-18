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
import { allowsPlant, homeFor } from '@open-garden/shared-types';
import { CALENDAR_ERRORS } from './domain-error';
import { overlapsThisWeek } from './this-week';
import {
  computeWindows,
  seasonYear,
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
  ) {}

  async list(
    userId: string,
    gardenId: string,
    page = 1,
    pageSize = 100,
    today = new Date(),
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
    const year = seasonYear({ lastFrost, firstFrost }, today);
    const result = await this.entries.listByGarden(gardenId, safePage, safeSize);

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
    const year = seasonYear(frost, asOf);
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
      seasonYear(frost, new Date(y!, m! - 1, d)),
      warmClimate(plant, garden.monthlyMeanC ?? null),
    );
  }

  async add(
    userId: string,
    gardenId: string,
    plantId: string,
  ): Promise<{ created: boolean; calendar: CalendarDto }> {
    await this.requireEditor(userId, gardenId);
    const plant = await this.plants.getById(plantId);
    if (!plant) throw CALENDAR_ERRORS.plantNotFound();
    // A property takes a plant when one of its areas does; vegetable is implied.
    if (this.areas && !allowsPlant('vegetable', plant.plantType)) {
      const home = homeFor(plant.plantType);
      if (!(await this.areas.hasKind(gardenId, home))) throw CALENDAR_ERRORS.areaRequired(home);
    }
    const { created } = await this.entries.insert(gardenId, plantId);
    const calendar = await this.list(userId, gardenId);
    return { created, calendar };
  }

  async remove(userId: string, gardenId: string, plantId: string): Promise<void> {
    await this.requireEditor(userId, gardenId);
    await this.entries.delete(gardenId, plantId);
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
