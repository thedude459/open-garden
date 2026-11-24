import type {
  AreaKind,
  BedCreateDto,
  BedPatchDto,
  BedStation,
  NamedBedDto,
  PropertyAreaDto,
  TrayDto,
} from '@open-garden/shared-types';
import {
  AREA_KINDS,
  areaKindFor,
  gardenAccess,
  mulchOrNone,
  placementRefusal,
  stationFor,
} from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  TrayRepository,
} from '@open-garden/plant-catalog-data';
import { domainError, PLANTING_ERRORS } from './domain-error';
import { normalizeBedName } from './beds';

/**
 * Beds, areas, and trays: the places a property grows things. Plantings
 * live in PlantingService; this service never changes one beyond moving
 * it out of a bed that is deleted.
 */
export class BedService {
  constructor(
    private readonly memberships: Pick<GardenMembershipRepository, 'get'>,
    private readonly plantings: Pick<
      PlantingRepository,
      'assignLooseTransplants' | 'deleteDirectSeedInBed' | 'occupants' | 'unassignTransplantsInBed'
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
      | 'getInGarden'
      | 'listByGarden'
      | 'rename'
    >,
    private readonly trays: Pick<TrayRepository, 'listByGarden' | 'open'>,
  ) {}

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

  private async requireBedEditor(userId: string, gardenId: string) {
    gardenAccess(await this.memberships.get(gardenId, userId), 'edit', PLANTING_ERRORS.viewerBeds);
  }
}

export function isAreaKind(kind: string): kind is AreaKind {
  return (AREA_KINDS as readonly string[]).includes(kind);
}

export function toStation(value: string | null | undefined): BedStation | null {
  return value === 'tree' || value === 'berry' ? value : null;
}

export function toAreaDto(row: { id: string; name: string; kind: string }): PropertyAreaDto {
  return { id: row.id, name: row.name, kind: isAreaKind(row.kind) ? row.kind : 'vegetable' };
}

export function toTrayDto(row: { id: string; areaId: string; name: string }): TrayDto {
  return { id: row.id, areaId: row.areaId, name: row.name };
}

export function toBedDto(row: {
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
