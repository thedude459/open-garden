import type {
  AreaKind,
  BedCreateDto,
  BedPatchDto,
  BedStation,
  GardenRole,
  NamedBedDto,
  PlantingCreateDto,
  PlantingDto,
  PlantingListDto,
  PlantingPatchDto,
  PlantStatus,
  PlantType,
  PropertyAreaDto,
  StartMethod,
  TrayDto,
} from '@open-garden/shared-types';
import {
  lifeForPlant,
  mulchOrNone,
  placementRefusal,
  plantOutPatch,
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
import { assertDatePair } from './dates';
import { normalizeBedName } from './beds';

export class PlantingService {
  constructor(
    private readonly memberships: GardenMembershipRepository,
    private readonly plants: PlantRepository,
    private readonly plantings: PlantingRepository,
    private readonly beds: BedRepository,
    private readonly areas?: PlantingAreaRepository,
    private readonly trays?: TrayRepository,
  ) {}

  async list(userId: string, gardenId: string, page = 1, pageSize = 200): Promise<PlantingListDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    const safePage = Math.max(1, page);
    const safeSize = Math.min(500, Math.max(1, pageSize));
    const [bedRows, result, areaRows, trayRows] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listByGarden(gardenId, safePage, safeSize),
      this.areas ? this.areas.listByGarden(gardenId) : Promise.resolve([]),
      this.trays ? this.trays.listByGarden(gardenId) : Promise.resolve([]),
    ]);
    const harvests = await this.harvestsByPlanting(gardenId);
    return {
      gardenId,
      myRole: membership.role as GardenRole,
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
    const plantedOn = dto.plantedOn ?? null;
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
        return { created: false, list: await this.list(userId, gardenId) };
      }
    }
    let bedId = dto.bedId ?? null;
    let trayId = dto.trayId ?? null;
    if (bedId) {
      await this.requireBedInGarden(gardenId, bedId);
      trayId = null;
    }
    if (trayId) await this.requireTray(gardenId, trayId);
    if (startMethod === 'transplant' && !bedId && !trayId && this.areas && this.trays) {
      const greenhouse = await this.areas.findByKind(gardenId, 'greenhouse');
      if (greenhouse) trayId = (await this.trays.open(gardenId, greenhouse.id, 'Tray')).id;
    }
    const station = await this.stationFor(gardenId, bedId);
    const life = lifeForPlant(plant.plantType, station, dto.life);
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
      plantedOn,
      harvestedOn,
      startMethod,
      indoorStartedOn,
      clientMutationId: dto.clientMutationId,
      life,
      note: dto.note ?? null,
      photo: dto.photo || null,
      plantedYear,
      rootstock: dto.rootstock ?? null,
      yearsToFruit: dto.yearsToFruit ?? null,
      spacingFeet: dto.spacingFeet ?? null,
    });
    return { created: true, list: await this.list(userId, gardenId) };
  }

  async update(userId: string, gardenId: string, plantingId: string, dto: PlantingPatchDto): Promise<PlantingDto> {
    await this.requirePlantingEditor(userId, gardenId);
    const current = await this.plantings.getInGarden(gardenId, plantingId);
    if (!current) throw PLANTING_ERRORS.plantingNotFound();
    const plantedOn = dto.plantedOn !== undefined ? dto.plantedOn : current.plantedOn;
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
    if (dto.bedId || dto.trayId) {
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
    if (dto.harvestedOn === null && current.harvestedOn && typeof this.plantings.deleteHarvest === 'function') {
      await this.plantings.deleteHarvest(plantingId, current.harvestedOn);
    }
    let life = dto.life;
    if (!life && dto.bedId && current.plantType === 'shrub') {
      const station = await this.stationFor(gardenId, dto.bedId);
      if (station === 'berry' && current.life !== 'perennial' && current.life !== 'tree') {
        life = 'perennial';
      }
    }
    const updated = await this.plantings.update(gardenId, plantingId, {
      plantedOn: dto.plantedOn,
      harvestedOn: dto.harvestedOn,
      bedId,
      trayId,
      clientMutationId: dto.clientMutationId,
      life,
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
    const station: BedStation | null =
      dto.station ?? (dto.kind === 'orchard' ? 'tree' : null);
    let areaId = dto.areaId;
    if (this.areas) {
      if (areaId) {
        const area = await this.areas.getInGarden(gardenId, areaId);
        if (!area) throw domainError('NOT_FOUND', 'Area not found');
      } else {
        areaId = (await this.areas.ensure(gardenId, station ? 'orchard' : 'vegetable')).id;
      }
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
      kind: 'bed',
      areaId,
      site: dto.site ?? 'in_ground',
      station,
      mulch: mulchOrNone(dto.mulch),
    });
    return { created: true, bed: toBedDto(row) };
  }

  async renameBed(userId: string, gardenId: string, bedId: string, dto: BedPatchDto): Promise<NamedBedDto> {
    await this.requireBedEditor(userId, gardenId);
    const current = await this.beds.getInGarden(gardenId, bedId);
    if (!current) throw PLANTING_ERRORS.bedNotFound();
    const names = normalizeBedName(dto.name);
    const taken = await this.beds.findByNormalizedName(gardenId, names.nameNormalized);
    if (taken && taken.id !== bedId) throw PLANTING_ERRORS.bedNameTaken();
    let row = await this.beds.rename(gardenId, bedId, names.name, names.nameNormalized);
    if (!row) throw PLANTING_ERRORS.bedNotFound();
    if (
      (dto.sun !== undefined || dto.kind !== undefined || dto.site !== undefined || dto.mulch !== undefined) &&
      typeof this.beds.setSite === 'function'
    ) {
      const site = await this.beds.setSite(gardenId, bedId, {
        sun: dto.sun,
        kind: dto.kind,
        site: dto.site,
        mulch: dto.mulch,
      });
      if (site) row = site;
    }
    return toBedDto(row);
  }

  async deleteBed(userId: string, gardenId: string, bedId: string): Promise<void> {
    await this.requireBedEditor(userId, gardenId);
    const current = await this.beds.getInGarden(gardenId, bedId);
    if (!current) throw PLANTING_ERRORS.bedNotFound();
    await this.plantings.deleteDirectSeedInBed(gardenId, bedId);
    await this.plantings.unassignTransplantsInBed(gardenId, bedId);
    if (this.areas && this.trays && typeof this.plantings.assignLooseTransplants === 'function') {
      const greenhouse = await this.areas.findByKind(gardenId, 'greenhouse');
      if (greenhouse) {
        const tray = await this.trays.open(gardenId, greenhouse.id, 'Tray');
        await this.plantings.assignLooseTransplants(gardenId, tray.id);
      }
    }
    const deleted = await this.beds.delete(gardenId, bedId);
    if (!deleted) throw PLANTING_ERRORS.bedNotFound();
  }

  async listAreas(userId: string, gardenId: string): Promise<PropertyAreaDto[]> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (!this.areas) return [];
    return (await this.areas.listByGarden(gardenId)).map(toAreaDto);
  }

  async createArea(userId: string, gardenId: string, kind: AreaKind): Promise<PropertyAreaDto> {
    await this.requireBedEditor(userId, gardenId);
    if (!this.areas) throw domainError('VALIDATION_ERROR', 'Areas are not available');
    return toAreaDto(await this.areas.add(gardenId, kind));
  }

  async listTrays(userId: string, gardenId: string): Promise<TrayDto[]> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (!this.trays) return [];
    return (await this.trays.listByGarden(gardenId)).map(toTrayDto);
  }

  async createTray(userId: string, gardenId: string, name: string): Promise<TrayDto> {
    await this.requireBedEditor(userId, gardenId);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) throw domainError('VALIDATION_ERROR', 'Tray name is required');
    if (!this.areas || !this.trays) throw domainError('VALIDATION_ERROR', 'Trays are not available');
    const greenhouse = await this.areas.ensure(gardenId, 'greenhouse');
    return toTrayDto(await this.trays.open(gardenId, greenhouse.id, trimmed));
  }

  private async requirePlantingEditor(userId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw PLANTING_ERRORS.viewerPlantings();
  }

  private async requireBedEditor(userId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw PLANTING_ERRORS.viewerBeds();
  }

  private async requireBedInGarden(gardenId: string, bedId: string) {
    const bed = await this.beds.getInGarden(gardenId, bedId);
    if (!bed) throw PLANTING_ERRORS.bedNotFound();
  }

  private async stationFor(gardenId: string, bedId: string | null): Promise<BedStation | null> {
    if (!bedId) return null;
    const bed = await this.beds.getInGarden(gardenId, bedId);
    return bed?.station === 'tree' || bed?.station === 'berry' ? bed.station : null;
  }

  private async requireTray(gardenId: string, trayId: string) {
    if (!this.trays) throw domainError('NOT_FOUND', 'Tray not found');
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
    if (!this.areas) return;
    if (trayId) {
      const reason = placementRefusal('greenhouse', null, plant.plantType, [], plant.id);
      if (reason) throw domainError('VALIDATION_ERROR', reason);
      return;
    }
    if (!bedId) {
      if (plant.plantType === 'tree' || plant.plantType === 'shrub') {
        throw domainError('VALIDATION_ERROR', 'Trees and shrubs belong in an orchard bed');
      }
      return;
    }
    const bed = await this.beds.getInGarden(gardenId, bedId);
    if (!bed) throw PLANTING_ERRORS.bedNotFound();
    const station = bed.station === 'tree' || bed.station === 'berry' ? bed.station : null;
    let kind: AreaKind = station ? 'orchard' : 'vegetable';
    if (bed.areaId) {
      const area = await this.areas.getById(bed.areaId);
      if (area?.kind === 'vegetable' || area?.kind === 'orchard' || area?.kind === 'greenhouse') {
        kind = area.kind;
      }
    }
    const occupants =
      typeof this.plantings.occupants === 'function' ? await this.plantings.occupants(bedId) : [];
    const reason = placementRefusal(
      kind,
      station,
      plant.plantType,
      occupants.filter((row) => row.id !== plantingId),
      plant.id,
    );
    if (reason) throw domainError('VALIDATION_ERROR', reason);
  }

  private async harvestsByPlanting(gardenId: string) {
    const map = new Map<string, string[]>();
    if (typeof this.plantings.listHarvests !== 'function') return map;
    for (const row of await this.plantings.listHarvests(gardenId)) {
      const list = map.get(row.plantingId) ?? [];
      list.push(row.harvestedOn);
      map.set(row.plantingId, list);
    }
    return map;
  }
}

function toAreaDto(row: { id: string; name: string; kind: string }): PropertyAreaDto {
  const kind = row.kind === 'orchard' || row.kind === 'greenhouse' ? row.kind : 'vegetable';
  return { id: row.id, name: row.name, kind };
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
  kind?: string | null;
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
    kind: row.kind === 'orchard' ? 'orchard' : 'bed',
    site: row.site === 'raised' ? 'raised' : 'in_ground',
    station: row.station === 'tree' || row.station === 'berry' ? row.station : null,
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
  const placed =
    row.layoutXInches != null && row.layoutYInches != null && row.bedId != null;
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
