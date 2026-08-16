import type {
  CalendarDto,
  CalendarEntryDto,
  CalendarWindowsDto,
  FrostAnchor,
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
  PlantRepository,
} from '@open-garden/plant-catalog-data';
import { CALENDAR_ERRORS } from './domain-error';
import { computeWindows, frostComplete } from './windows';

export class CalendarService {
  constructor(
    private readonly gardens: GardenRepository,
    private readonly memberships: GardenMembershipRepository,
    private readonly plants: PlantRepository,
    private readonly entries: CalendarEntryRepository,
  ) {}

  async list(userId: string, gardenId: string, page = 1, pageSize = 100): Promise<CalendarDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw CALENDAR_ERRORS.gardenNotFound();
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw CALENDAR_ERRORS.gardenNotFound();

    const safePage = Math.max(1, page);
    const safeSize = Math.min(200, Math.max(1, pageSize));
    const lastFrost = pair(garden.lastFrostMonth, garden.lastFrostDay);
    const firstFrost = pair(garden.firstFrostMonth, garden.firstFrostDay);
    const windowsAvailable = frostComplete({ lastFrost, firstFrost });
    const result = await this.entries.listByGarden(gardenId, safePage, safeSize);

    return {
      gardenId: garden.id,
      myRole: membership.role as GardenRole,
      windowsAvailable,
      hardinessZone: garden.hardinessZone,
      lastFrost,
      firstFrost,
      entries: result.items.map((row) => toEntry(row, garden.hardinessZone, lastFrost, firstFrost)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalCount,
    };
  }

  async add(
    userId: string,
    gardenId: string,
    plantId: string,
  ): Promise<{ created: boolean; calendar: CalendarDto }> {
    await this.requireEditor(userId, gardenId);
    const plant = await this.plants.getById(plantId);
    if (!plant) throw CALENDAR_ERRORS.plantNotFound();
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

type EntryRow = {
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: string;
  status: string;
  zoneMin: number;
  zoneMax: number;
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
};

function toEntry(
  row: EntryRow,
  gardenZone: number | null,
  lastFrost: MonthDayDto | null,
  firstFrost: MonthDayDto | null,
): CalendarEntryDto {
  const guidance = guidanceFromRow(row);
  const windows: CalendarWindowsDto = computeWindows(
    { lastFrost, firstFrost },
    guidance,
    row.daysToMaturity,
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
  };
}

function guidanceFromRow(row: EntryRow): GrowingGuidanceDto {
  return {
    indoorStart: triplet(row.indoorFrostAnchor, row.indoorWeeksEarliest, row.indoorWeeksLatest),
    outdoorSow: triplet(row.sowFrostAnchor, row.sowWeeksEarliest, row.sowWeeksLatest),
    transplant: triplet(
      row.transplantFrostAnchor,
      row.transplantWeeksEarliest,
      row.transplantWeeksLatest,
    ),
  };
}

function triplet(
  anchor: string | null,
  earliest: number | null,
  latest: number | null,
): FrostRelativeWeeksDto | null {
  if (anchor !== 'last' && anchor !== 'first') return null;
  if (earliest == null || latest == null) return null;
  return { frostAnchor: anchor as FrostAnchor, weeksEarliest: earliest, weeksLatest: latest };
}

function zoneMismatch(gardenZone: number | null, zoneMin: number, zoneMax: number): boolean | null {
  if (gardenZone == null) return null;
  return !(zoneMin <= gardenZone && gardenZone <= zoneMax);
}

function pair(month: number | null, day: number | null): MonthDayDto | null {
  if (month == null || day == null) return null;
  return { month, day };
}
