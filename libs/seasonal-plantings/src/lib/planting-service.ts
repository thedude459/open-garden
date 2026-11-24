import type {
  AreaKind,
  BedCreateDto,
  BedPatchDto,
  BedStation,
  CropHarvestDto,
  GardenRole,
  HarvestDto,
  HarvestTotalsDto,
  NamedBedDto,
  PlantingCreateDto,
  PlantingDto,
  PlantingListDto,
  PlantingPatchDto,
  PlantingRepeatResultDto,
  PlantStatus,
  PlantType,
  PropertyAreaDto,
  StartMethod,
  TrayDto,
} from '@open-garden/shared-types';
import {
  AREA_KINDS,
  areaKindFor,
  MAX_SUCCESSION_SOWINGS,
  plantName,
  lifeForPlant,
  mulchOrNone,
  placementRefusal,
  plantOutPatch,
  stationFor,
  gardenAccess,
} from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  PlantRepository,
  TrayRepository,
} from '@open-garden/plant-catalog-data';
import { domainError, PLANTING_ERRORS } from './domain-error';
import { addDays, assertDatePair, diffDays, plannedOrPlanted, utcToday } from './dates';
import { normalizeBedName } from './beds';

/**
 * Every dependency is required and typed as the slice this service uses: a
 * caller cannot leave out the areas that enforce principle VIII, and a test
 * fake needs only these methods.
 */
export class PlantingService {
  constructor(
    private readonly memberships: Pick<GardenMembershipRepository, 'get'>,
    private readonly plants: Pick<PlantRepository, 'getById'>,
    private readonly plantings: Pick<
      PlantingRepository,
      | 'assignLooseTransplants'
      | 'clearLayoutCoords'
      | 'delete'
      | 'deleteDirectSeedInBed'
      | 'deleteHarvest'
      | 'getById'
      | 'getInGarden'
      | 'harvestSeasons'
      | 'insert'
      | 'listByGarden'
      | 'listHarvests'
      | 'listHarvestsForSeason'
      | 'listUnplacedTransplants'
      | 'logHarvest'
      | 'occupants'
      | 'unassignTransplantsInBed'
      | 'update'
    >,
    private readonly beds: Pick<
      BedRepository,
      | 'delete'
      | 'findByNormalizedName'
      | 'getById'
      | 'getInGarden'
      | 'insert'
      | 'listByGarden'
      | 'rename'
      | 'setArea'
      | 'setSite'
    >,
    private readonly areas: Pick<
      PlantingAreaRepository,
      | 'add'
      | 'delete'
      | 'ensure'
      | 'findByKind'
      | 'findByName'
      | 'getById'
      | 'getInGarden'
      | 'listByGarden'
      | 'rename'
    >,
    private readonly trays: Pick<TrayRepository, 'getInGarden' | 'listByGarden' | 'open'>,
    private readonly sowing: SowingPlanner,
    /** The property's current season, for planning the next one (ADR 0040). */
    private readonly seasons: { currentYear(gardenId: string): Promise<number> },
  ) {}

  /**
   * The season asked for, which must be the current one or the next. The
   * repository is given undefined for the current season, so a property that
   * never closed one keeps its earlier years' annuals.
   */
  private async season(gardenId: string, seasonYear?: number) {
    const current = await this.seasons.currentYear(gardenId);
    const year = seasonYear ?? current;
    if (year !== current && year !== current + 1) throw PLANTING_ERRORS.seasonOutOfRange();
    return { year, current, query: year === current ? undefined : year };
  }

  async list(
    userId: string,
    gardenId: string,
    page = 1,
    pageSize = 200,
    seasonYear?: number,
  ): Promise<PlantingListDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    const season = await this.season(gardenId, seasonYear);
    const safePage = Math.max(1, page);
    const safeSize = Math.min(500, Math.max(1, pageSize));
    const [bedRows, result, areaRows, trayRows] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listByGarden(gardenId, safePage, safeSize, season.query),
      this.areas ? this.areas.listByGarden(gardenId) : Promise.resolve([]),
      this.trays ? this.trays.listByGarden(gardenId) : Promise.resolve([]),
    ]);
    const harvests = await this.harvestsByPlanting(gardenId);
    return {
      gardenId,
      myRole: membership.role as GardenRole,
      seasonYear: season.year,
      currentSeasonYear: season.current,
      beds: bedRows.map(toBedDto),
      plantings: result.items.map((row) => ({
        ...toPlantingDto(row),
        harvests: harvests.get(row.id) ?? [],
      })),
      areas: areaRows.map(toAreaDto),
      trays: trayRows.map(toTrayDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalCount,
    };
  }

  async create(
    userId: string,
    gardenId: string,
    dto: PlantingCreateDto,
  ): Promise<{ created: boolean; list: PlantingListDto }> {
    await this.requirePlantingEditor(userId, gardenId);
    if (!dto.plantId) throw PLANTING_ERRORS.plantRequired();
    const plant = await this.plants.getById(dto.plantId);
    if (!plant) throw PLANTING_ERRORS.plantNotFound();
    const season = await this.season(gardenId, dto.seasonYear);
    const dates = plannedOrPlanted(dto.plannedOn ?? null, dto.plantedOn ?? null, utcToday());
    const plannedOn = dates.plannedOn ?? null;
    const plantedOn = dates.plantedOn ?? null;
    const harvestedOn = dto.harvestedOn ?? null;
    assertDatePair(plantedOn, harvestedOn);
    const startMethod = dto.startMethod ?? 'direct_seed';
    const indoorStartedOn = dto.indoorStartedOn ?? null;
    if (startMethod === 'transplant' && !indoorStartedOn) {
      throw PLANTING_ERRORS.indoorStartRequired();
    }
    if (startMethod === 'direct_seed' && indoorStartedOn) {
      throw PLANTING_ERRORS.indoorStartForbidden();
    }
    if (dto.id) {
      const existing = await this.plantings.getById(dto.id);
      if (existing) {
        if (existing.gardenId !== gardenId) throw PLANTING_ERRORS.idInUse();
        return {
          created: false,
          list: await this.list(userId, gardenId, 1, 200, dto.seasonYear),
        };
      }
    }
    const bedId = dto.bedId ?? null;
    let trayId = dto.trayId ?? null;
    if (bedId) {
      await this.requireBedInGarden(gardenId, bedId);
      trayId = null;
    }
    if (trayId) await this.requireTray(gardenId, trayId);
    if (startMethod === 'transplant' && !bedId && !trayId) {
      const greenhouse = await this.areas.findByKind(gardenId, 'greenhouse');
      if (greenhouse) trayId = (await this.trays.open(gardenId, greenhouse.id, 'Tray')).id;
    }
    const life = lifeForPlant(plant.plantType, dto.life, plant.perennial);
    await this.assertFits(gardenId, plant, bedId, trayId, null);
    const plantedYear =
      dto.plantedYear !== undefined
        ? dto.plantedYear
        : life === 'tree'
          ? new Date().getUTCFullYear()
          : null;

    await this.plantings.insert({
      id: dto.id,
      gardenId,
      plantId: dto.plantId,
      bedId,
      trayId,
      plannedOn,
      plantedOn,
      harvestedOn,
      startMethod,
      indoorStartedOn,
      clientMutationId: dto.clientMutationId,
      life,
      // A planting added while the next season is shown belongs to it.
      seasonYear: season.query,
      note: dto.note ?? null,
      photo: dto.photo || null,
      plantedYear,
      rootstock: dto.rootstock ?? null,
      yearsToFruit: dto.yearsToFruit ?? null,
      spacingFeet: dto.spacingFeet ?? null,
    });
    return { created: true, list: await this.list(userId, gardenId, 1, 200, dto.seasonYear) };
  }

  async update(
    userId: string,
    gardenId: string,
    plantingId: string,
    dto: PlantingPatchDto,
  ): Promise<PlantingDto> {
    await this.requirePlantingEditor(userId, gardenId);
    const current = await this.plantings.getInGarden(gardenId, plantingId);
    if (!current) throw PLANTING_ERRORS.plantingNotFound();
    const dates = plannedOrPlanted(dto.plannedOn, dto.plantedOn, utcToday());
    const plantedOn = dates.plantedOn !== undefined ? dates.plantedOn : current.plantedOn;
    const harvestedOn = dto.harvestedOn !== undefined ? dto.harvestedOn : current.harvestedOn;
    assertDatePair(plantedOn, harvestedOn);
    let bedId = dto.bedId;
    let trayId = dto.trayId;
    if (dto.bedId) {
      await this.requireBedInGarden(gardenId, dto.bedId);
      const moved = plantOutPatch(dto.bedId);
      bedId = moved.bedId;
      trayId = moved.trayId;
    } else if (dto.trayId) {
      await this.requireTray(gardenId, dto.trayId);
      bedId = null;
    }
    // Only a move is checked: a catalog update may change what a bed accepts,
    // and a planting already there is flagged on the plan, never blocked.
    const moving =
      (dto.bedId && dto.bedId !== current.bedId) || (dto.trayId && dto.trayId !== current.trayId);
    if (moving) {
      await this.assertFits(
        gardenId,
        { id: current.plantId, plantType: current.plantType },
        bedId ?? null,
        trayId ?? null,
        plantingId,
      );
    }
    const bedChanging = bedId !== undefined && bedId !== current.bedId;
    if (bedChanging || dto.trayId) {
      await this.plantings.clearLayoutCoords(gardenId, plantingId);
    }
    if (dto.harvestedOn === null && current.harvestedOn) {
      await this.plantings.deleteHarvest(plantingId, current.harvestedOn);
    }
    const updated = await this.plantings.update(gardenId, plantingId, {
      plannedOn: dates.plannedOn,
      plantedOn: dates.plantedOn,
      harvestedOn: dto.harvestedOn,
      bedId,
      trayId,
      clientMutationId: dto.clientMutationId,
      life: dto.life,
      note: dto.note,
      photo: dto.photo,
      plantedYear: dto.plantedYear,
      rootstock: dto.rootstock,
      yearsToFruit: dto.yearsToFruit,
      spacingFeet: dto.spacingFeet,
    });
    if (!updated) throw PLANTING_ERRORS.plantingNotFound();
    const row = await this.plantings.getInGarden(gardenId, plantingId);
    if (!row) throw PLANTING_ERRORS.plantingNotFound();
    const harvests = await this.harvestsByPlanting(gardenId);
    return { ...toPlantingDto(row), harvests: harvests.get(row.id) ?? [] };
  }

  /**
   * Succession planting: copies of a planting sown every `everyWeeks` weeks
   * after it, up to `until`, in the same season. Each copy keeps the crop and
   * start method (a transplant's indoor start moves with its sow date) and
   * starts without a bed or tray, to be placed when it is sown. With a sowing
   * planner, dates outside the crop's sowing windows and after the last
   * sowing that ripens before frost are left out (ADR 0037).
   */
  async repeat(
    userId: string,
    gardenId: string,
    plantingId: string,
    everyWeeks: number,
    until: string,
  ): Promise<PlantingRepeatResultDto> {
    const current = await this.repeatable(userId, gardenId, plantingId);
    const plan = await this.planFor(gardenId, current);
    const candidates: string[] = [];
    for (let days = everyWeeks * 7; ; days += everyWeeks * 7) {
      const date = addDays(current.plantedOn, days);
      if (date > until) break;
      candidates.push(date);
      // A date years ahead cannot fit 26 sowings in any season's windows.
      if (candidates.length > 52 * 2) throw PLANTING_ERRORS.repeatTooMany(MAX_SUCCESSION_SOWINGS);
    }
    const tooLate = candidates.filter((d) => plan?.lastSowOn != null && d > plan.lastSowOn);
    const inSeason = candidates.filter((d) => !tooLate.includes(d));
    const dates = inSeason.filter((d) => inWindows(d, plan?.windows));
    if (dates.length > MAX_SUCCESSION_SOWINGS) {
      throw PLANTING_ERRORS.repeatTooMany(MAX_SUCCESSION_SOWINGS);
    }
    if (!dates.length) throw PLANTING_ERRORS.repeatNothing(plan?.lastSowOn ?? null);
    const shift = (date: string) => diffDays(current.plantedOn, date);
    for (const date of dates) {
      await this.plantings.insert({
        gardenId,
        plantId: current.plantId,
        bedId: null,
        trayId: null,
        // Each copy is a sowing still to come (ADR 0040).
        plannedOn: date,
        plantedOn: null,
        harvestedOn: null,
        startMethod: current.startMethod,
        indoorStartedOn: current.indoorStartedOn
          ? addDays(current.indoorStartedOn, shift(date))
          : null,
        life: current.life,
        seasonYear: current.seasonYear,
      });
    }
    return {
      list: await this.list(userId, gardenId),
      added: dates.length,
      outOfWindow: inSeason.length - dates.length,
      tooLate: tooLate.length,
      lastSowOn: plan?.lastSowOn ?? null,
    };
  }

  /** The last sowing of this planting's crop that ripens before frost, to suggest an end. */
  async repeatPlan(
    userId: string,
    gardenId: string,
    plantingId: string,
  ): Promise<{ lastSowOn: string | null }> {
    const current = await this.repeatable(userId, gardenId, plantingId);
    return { lastSowOn: (await this.planFor(gardenId, current))?.lastSowOn ?? null };
  }

  private async repeatable(userId: string, gardenId: string, plantingId: string) {
    await this.requirePlantingEditor(userId, gardenId);
    const current = await this.plantings.getInGarden(gardenId, plantingId);
    if (!current) throw PLANTING_ERRORS.plantingNotFound();
    // A series counts from the first sowing, done or still planned.
    const sowOn = current.plantedOn ?? current.plannedOn;
    if (!sowOn) throw PLANTING_ERRORS.repeatNeedsSowDate();
    if (current.life !== 'annual') throw PLANTING_ERRORS.repeatAnnualsOnly();
    return { ...current, plantedOn: sowOn };
  }

  private planFor(
    gardenId: string,
    current: { plantId: string; startMethod: string; plantedOn: string },
  ) {
    return this.sowing.plan(gardenId, current.plantId, current.startMethod, current.plantedOn);
  }

  /**
   * Log a harvest from a planting (ADR 0038). A second one on the same day
   * adds to it. Returns the planting with its harvests.
   */
  async logHarvest(
    userId: string,
    gardenId: string,
    plantingId: string,
    harvest: { harvestedOn: string; grams?: number | null; count?: number | null },
  ): Promise<PlantingDto> {
    await this.requirePlantingEditor(userId, gardenId);
    const current = await this.plantings.getInGarden(gardenId, plantingId);
    if (!current) throw PLANTING_ERRORS.plantingNotFound();
    if (current.plantedOn && harvest.harvestedOn < current.plantedOn) {
      throw PLANTING_ERRORS.harvestBeforePlanted();
    }
    await this.plantings.logHarvest(
      plantingId,
      harvest.harvestedOn,
      harvest.grams ?? null,
      harvest.count ?? null,
    );
    return this.plantingWithHarvests(gardenId, plantingId);
  }

  /** Remove one day's harvest; a planting marked harvested that day is no longer. */
  async deleteHarvest(
    userId: string,
    gardenId: string,
    plantingId: string,
    harvestedOn: string,
  ): Promise<PlantingDto> {
    await this.requirePlantingEditor(userId, gardenId);
    const current = await this.plantings.getInGarden(gardenId, plantingId);
    if (!current) throw PLANTING_ERRORS.plantingNotFound();
    await this.plantings.deleteHarvest(plantingId, harvestedOn);
    if (current.harvestedOn === harvestedOn) {
      await this.plantings.update(gardenId, plantingId, { harvestedOn: null });
    }
    return this.plantingWithHarvests(gardenId, plantingId);
  }

  /**
   * A season's harvests at a property, by crop with totals (ADR 0038). Any
   * member may read them. Without `seasonYear`, the latest season with any.
   */
  async harvestTotals(
    userId: string,
    gardenId: string,
    seasonYear?: number,
  ): Promise<HarvestTotalsDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    const seasons = await this.plantings.harvestSeasons(gardenId);
    const year = seasonYear ?? seasons[0] ?? new Date().getFullYear();
    const crops = new Map<string, CropHarvestDto>();
    for (const row of await this.plantings.listHarvestsForSeason(gardenId, year)) {
      const key = row.cropId ?? row.plantId;
      const crop = crops.get(key) ?? { name: row.commonName, grams: 0, count: 0, harvests: [] };
      crop.grams += row.grams ?? 0;
      crop.count += row.count ?? 0;
      crop.harvests.push({
        plantingId: row.plantingId,
        plantName: plantName(row),
        harvestedOn: row.harvestedOn,
        grams: row.grams ?? null,
        count: row.count ?? null,
      });
      crops.set(key, crop);
    }
    return {
      seasonYear: year,
      seasons,
      crops: [...crops.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private async plantingWithHarvests(gardenId: string, plantingId: string): Promise<PlantingDto> {
    const row = await this.plantings.getInGarden(gardenId, plantingId);
    if (!row) throw PLANTING_ERRORS.plantingNotFound();
    const harvests = await this.harvestsByPlanting(gardenId);
    return { ...toPlantingDto(row), harvests: harvests.get(row.id) ?? [] };
  }

  async remove(userId: string, gardenId: string, plantingId: string): Promise<void> {
    await this.requirePlantingEditor(userId, gardenId);
    const deleted = await this.plantings.delete(gardenId, plantingId);
    if (!deleted) throw PLANTING_ERRORS.plantingNotFound();
  }

  async listUnplacedTransplants(
    userId: string,
    gardenId: string,
  ): Promise<{ myRole: GardenRole; plantings: ReturnType<typeof toLayoutPlanting>[] }> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    const rows = await this.plantings.listUnplacedTransplants(gardenId);
    return {
      myRole: membership.role as GardenRole,
      plantings: rows.map(toLayoutPlanting),
    };
  }

  async createBed(
    userId: string,
    gardenId: string,
    dto: BedCreateDto,
  ): Promise<{ created: boolean; bed: NamedBedDto }> {
    await this.requireBedEditor(userId, gardenId);
    if (dto.lengthInches < 1 || dto.widthInches < 1) throw PLANTING_ERRORS.bedSizeRequired();
    const names = normalizeBedName(dto.name);
    if (dto.id) {
      const existing = await this.beds.getById(dto.id);
      if (existing) {
        if (existing.gardenId !== gardenId) throw PLANTING_ERRORS.idInUse();
        return { created: false, bed: toBedDto(existing) };
      }
    }
    const taken = await this.beds.findByNormalizedName(gardenId, names.nameNormalized);
    if (taken) throw PLANTING_ERRORS.bedNameTaken();
    let station: BedStation | null = dto.station ?? null;
    let areaId = dto.areaId;
    if (areaId) {
      const area = await this.areas.getInGarden(gardenId, areaId);
      if (!area) throw domainError('NOT_FOUND', 'Area not found');
      // The station follows the area, so the bed's rules are the area's.
      station = stationFor(isAreaKind(area.kind) ? area.kind : 'vegetable', station);
    } else {
      areaId = (await this.areas.ensure(gardenId, areaKindFor(station))).id;
    }
    const row = await this.beds.insert({
      id: dto.id,
      gardenId,
      name: names.name,
      nameNormalized: names.nameNormalized,
      originXInches: dto.originXInches ?? 0,
      originYInches: dto.originYInches ?? 0,
      lengthInches: dto.lengthInches,
      widthInches: dto.widthInches,
      areaId,
      site: dto.site ?? 'in_ground',
      station,
      mulch: mulchOrNone(dto.mulch),
    });
    return { created: true, bed: toBedDto(row) };
  }

  async renameBed(
    userId: string,
    gardenId: string,
    bedId: string,
    dto: BedPatchDto,
  ): Promise<NamedBedDto> {
    await this.requireBedEditor(userId, gardenId);
    const current = await this.beds.getInGarden(gardenId, bedId);
    if (!current) throw PLANTING_ERRORS.bedNotFound();
    const names = normalizeBedName(dto.name);
    const taken = await this.beds.findByNormalizedName(gardenId, names.nameNormalized);
    if (taken && taken.id !== bedId) throw PLANTING_ERRORS.bedNameTaken();
    let row = await this.beds.rename(gardenId, bedId, names.name, names.nameNormalized);
    if (!row) throw PLANTING_ERRORS.bedNotFound();
    if (dto.sun !== undefined || dto.site !== undefined || dto.mulch !== undefined) {
      const site = await this.beds.setSite(gardenId, bedId, {
        sun: dto.sun,
        site: dto.site,
        mulch: dto.mulch,
      });
      if (site) row = site;
    }
    if (dto.areaId !== undefined && dto.areaId !== row.areaId) {
      row = await this.moveBed(gardenId, bedId, dto.areaId, toStation(row.station));
    }
    return toBedDto(row);
  }

  /**
   * Moves a bed to another area of the property. Every plant in it must suit
   * the new area, as when it was placed (a hard gate, principle VIII); its
   * station follows the area's kind.
   */
  private async moveBed(
    gardenId: string,
    bedId: string,
    areaId: string,
    current: BedStation | null,
  ) {
    const area = await this.areas.getInGarden(gardenId, areaId);
    if (!area) throw domainError('NOT_FOUND', 'Area not found');
    const kind = isAreaKind(area.kind) ? area.kind : 'vegetable';
    if (kind === 'greenhouse') {
      throw domainError('VALIDATION_ERROR', 'A greenhouse holds trays, not beds');
    }
    const station = stationFor(kind, current);
    const occupants = await this.plantings.occupants(bedId);
    for (const [i, plant] of occupants.entries()) {
      const reason = placementRefusal(kind, plant.plantType, occupants.slice(0, i), station);
      if (reason)
        throw domainError('VALIDATION_ERROR', `${area.name} will not take this bed: ${reason}`);
    }
    const moved = await this.beds.setArea(gardenId, bedId, areaId, station);
    if (!moved) throw PLANTING_ERRORS.bedNotFound();
    return moved;
  }

  async deleteBed(userId: string, gardenId: string, bedId: string): Promise<void> {
    await this.requireBedEditor(userId, gardenId);
    const current = await this.beds.getInGarden(gardenId, bedId);
    if (!current) throw PLANTING_ERRORS.bedNotFound();
    await this.plantings.deleteDirectSeedInBed(gardenId, bedId);
    await this.plantings.unassignTransplantsInBed(gardenId, bedId);
    const greenhouse = await this.areas.findByKind(gardenId, 'greenhouse');
    if (greenhouse) {
      const tray = await this.trays.open(gardenId, greenhouse.id, 'Tray');
      await this.plantings.assignLooseTransplants(gardenId, tray.id);
    }
    const deleted = await this.beds.delete(gardenId, bedId);
    if (!deleted) throw PLANTING_ERRORS.bedNotFound();
  }

  async listAreas(userId: string, gardenId: string): Promise<PropertyAreaDto[]> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    return (await this.areas.listByGarden(gardenId)).map(toAreaDto);
  }

  async createArea(userId: string, gardenId: string, kind: AreaKind): Promise<PropertyAreaDto> {
    await this.requireBedEditor(userId, gardenId);
    return toAreaDto(await this.areas.add(gardenId, kind));
  }

  async renameArea(
    userId: string,
    gardenId: string,
    areaId: string,
    name: string,
  ): Promise<PropertyAreaDto> {
    await this.requireBedEditor(userId, gardenId);
    const trimmed = name.trim();
    if (!trimmed) throw domainError('VALIDATION_ERROR', 'Area name is required');
    if (trimmed.length > 120) {
      throw domainError('VALIDATION_ERROR', 'Area name must be at most 120 characters');
    }
    const taken = await this.areas.findByName(gardenId, trimmed);
    if (taken && taken.id !== areaId) {
      throw domainError('CONFLICT', 'That property already has an area with that name');
    }
    const row = await this.areas.rename(gardenId, areaId, trimmed);
    if (!row) throw domainError('NOT_FOUND', 'Area not found');
    return toAreaDto(row);
  }

  /** Deletes an empty area; one that holds beds or trays is refused, so nothing is lost. */
  async deleteArea(userId: string, gardenId: string, areaId: string): Promise<void> {
    await this.requireBedEditor(userId, gardenId);
    const area = await this.areas.getInGarden(gardenId, areaId);
    if (!area) throw domainError('NOT_FOUND', 'Area not found');
    const beds = (await this.beds.listByGarden(gardenId)).filter((bed) => bed.areaId === areaId);
    const trays = (await this.trays.listByGarden(gardenId)).filter(
      (tray) => tray.areaId === areaId,
    );
    if (beds.length || trays.length) {
      const what = beds.length ? (beds.length === 1 ? '1 bed' : `${beds.length} beds`) : 'trays';
      throw domainError(
        'CONFLICT',
        `${area.name} still holds ${what}: move or delete ${beds.length ? 'them' : 'its trays'} first`,
      );
    }
    await this.areas.delete(gardenId, areaId);
  }

  async listTrays(userId: string, gardenId: string): Promise<TrayDto[]> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    return (await this.trays.listByGarden(gardenId)).map(toTrayDto);
  }

  async createTray(userId: string, gardenId: string, name: string): Promise<TrayDto> {
    await this.requireBedEditor(userId, gardenId);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120)
      throw domainError('VALIDATION_ERROR', 'Tray name is required');
    const greenhouse = await this.areas.ensure(gardenId, 'greenhouse');
    return toTrayDto(await this.trays.open(gardenId, greenhouse.id, trimmed));
  }

  private async requirePlantingEditor(userId: string, gardenId: string) {
    gardenAccess(
      await this.memberships.get(gardenId, userId),
      'edit',
      PLANTING_ERRORS.viewerPlantings,
    );
  }

  private async requireBedEditor(userId: string, gardenId: string) {
    gardenAccess(await this.memberships.get(gardenId, userId), 'edit', PLANTING_ERRORS.viewerBeds);
  }

  private async requireBedInGarden(gardenId: string, bedId: string) {
    const bed = await this.beds.getInGarden(gardenId, bedId);
    if (!bed) throw PLANTING_ERRORS.bedNotFound();
  }

  private async requireTray(gardenId: string, trayId: string) {
    const tray = await this.trays.getInGarden(gardenId, trayId);
    if (!tray) throw domainError('NOT_FOUND', 'Tray not found');
  }

  private async assertFits(
    gardenId: string,
    plant: { id: string; plantType: string },
    bedId: string | null,
    trayId: string | null,
    plantingId: string | null,
  ) {
    let area: AreaKind = 'vegetable';
    let occupants: { id: string; plantType: string }[] = [];
    let station: BedStation | null = null;
    if (trayId) {
      area = 'greenhouse';
    } else if (bedId) {
      const bed = await this.beds.getInGarden(gardenId, bedId);
      if (!bed) throw PLANTING_ERRORS.bedNotFound();
      station = toStation(bed.station);
      // The bed's area decides what it takes; its station only says whether
      // it is a tree bed (one tree) or a row.
      const row = await this.areas.getById(bed.areaId);
      area = row && isAreaKind(row.kind) ? row.kind : 'vegetable';
      occupants = (await this.plantings.occupants(bedId)).filter((row) => row.id !== plantingId);
    }
    // With no bed yet, a planting must be one a vegetable garden takes.
    const reason = placementRefusal(area, plant.plantType, occupants, station);
    if (reason) throw domainError('VALIDATION_ERROR', reason);
  }

  private async harvestsByPlanting(gardenId: string) {
    const map = new Map<string, HarvestDto[]>();
    for (const row of await this.plantings.listHarvests(gardenId)) {
      const list = map.get(row.plantingId) ?? [];
      list.push({
        harvestedOn: row.harvestedOn,
        grams: row.grams ?? null,
        count: row.count ?? null,
      });
      map.set(row.plantingId, list);
    }
    return map;
  }
}

function isAreaKind(kind: string): kind is AreaKind {
  return (AREA_KINDS as readonly string[]).includes(kind);
}

function toStation(value: string | null | undefined): BedStation | null {
  return value === 'tree' || value === 'berry' ? value : null;
}

function toAreaDto(row: { id: string; name: string; kind: string }): PropertyAreaDto {
  return { id: row.id, name: row.name, kind: isAreaKind(row.kind) ? row.kind : 'vegetable' };
}

function toTrayDto(row: { id: string; areaId: string; name: string }): TrayDto {
  return { id: row.id, areaId: row.areaId, name: row.name };
}

function toBedDto(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  sun?: string | null;
  site?: string | null;
  station?: string | null;
  mulch?: string | null;
  areaId?: string | null;
}): NamedBedDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sun: (row.sun as NamedBedDto['sun']) ?? null,
    site: row.site === 'raised' ? 'raised' : 'in_ground',
    station: toStation(row.station),
    mulch: mulchOrNone(row.mulch),
    areaId: row.areaId ?? null,
  };
}

function toPlantingDto(row: {
  id: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: string;
  status: string;
  plannedOn?: string | null;
  plantedOn: string | null;
  harvestedOn: string | null;
  bedId: string | null;
  trayId?: string | null;
  startMethod?: string;
  indoorStartedOn?: string | null;
  life?: string;
  seasonYear?: number;
  note?: string | null;
  photo?: string | null;
  plantedYear?: number | null;
  rootstock?: string | null;
  yearsToFruit?: number | null;
  spacingFeet?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): PlantingDto {
  const life = row.life === 'perennial' || row.life === 'tree' ? row.life : 'annual';
  return {
    id: row.id,
    plantId: row.plantId,
    commonName: row.commonName,
    species: row.species,
    cultivar: row.cultivar,
    plantType: row.plantType as PlantType,
    status: row.status as PlantStatus,
    plannedOn: row.plannedOn ?? null,
    plantedOn: row.plantedOn,
    harvestedOn: row.harvestedOn,
    bedId: row.bedId,
    trayId: row.trayId ?? null,
    startMethod: (row.startMethod ?? 'direct_seed') as StartMethod,
    indoorStartedOn: row.indoorStartedOn ?? null,
    life,
    seasonYear: row.seasonYear,
    note: row.note ?? null,
    photo: row.photo ?? null,
    plantedYear: row.plantedYear ?? null,
    rootstock: row.rootstock ?? null,
    yearsToFruit: row.yearsToFruit ?? null,
    spacingFeet: row.spacingFeet ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLayoutPlanting(row: {
  id: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: string;
  status: string;
  bedId: string | null;
  spacingInches: number | null;
  startMethod?: string;
  indoorStartedOn?: string | null;
  layoutXInches?: number | null;
  layoutYInches?: number | null;
  waterIntervalDays?: number | null;
  fertilizeIntervalDays?: number | null;
}) {
  const placed = row.layoutXInches != null && row.layoutYInches != null && row.bedId != null;
  return {
    id: row.id,
    plantId: row.plantId,
    commonName: row.commonName,
    species: row.species,
    cultivar: row.cultivar,
    plantType: row.plantType as PlantType,
    status: row.status as PlantStatus,
    bedId: row.bedId,
    spacingInches: row.spacingInches,
    startMethod: (row.startMethod ?? 'transplant') as StartMethod,
    indoorStartedOn: row.indoorStartedOn ?? null,
    waterIntervalDays: row.waterIntervalDays ?? null,
    fertilizeIntervalDays: row.fertilizeIntervalDays ?? null,
    placement: placed
      ? {
          plantingId: row.id,
          bedId: row.bedId!,
          xInches: row.layoutXInches!,
          yInches: row.layoutYInches!,
        }
      : null,
  };
}

/** Where a sowing series may land: the crop's sowing windows and its last useful sowing. */
export interface SowingPlanner {
  plan(
    gardenId: string,
    plantId: string,
    startMethod: string,
    firstSowOn: string,
  ): Promise<{ windows: { from: string; to: string }[]; lastSowOn: string | null } | null>;
}

/** Inside one of the windows; with no windows known, any date is. */
function inWindows(date: string, windows: { from: string; to: string }[] | undefined): boolean {
  return !windows?.length || windows.some((w) => w.from <= date && date <= w.to);
}
