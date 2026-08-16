import type {
  BedCreateDto,
  BedPatchDto,
  GardenRole,
  NamedBedDto,
  PlantingCreateDto,
  PlantingDto,
  PlantingListDto,
  PlantingPatchDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  PlantingRepository,
  PlantRepository,
} from '@open-garden/plant-catalog-data';
import { PLANTING_ERRORS } from './domain-error';
import { assertDatePair } from './dates';
import { normalizeBedName } from './beds';

export class PlantingService {
  constructor(
    private readonly memberships: GardenMembershipRepository,
    private readonly plants: PlantRepository,
    private readonly plantings: PlantingRepository,
    private readonly beds: BedRepository,
  ) {}

  async list(userId: string, gardenId: string, page = 1, pageSize = 200): Promise<PlantingListDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    const safePage = Math.max(1, page);
    const safeSize = Math.min(500, Math.max(1, pageSize));
    const [bedRows, result] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listByGarden(gardenId, safePage, safeSize),
    ]);
    return {
      gardenId,
      myRole: membership.role as GardenRole,
      beds: bedRows.map(toBedDto),
      plantings: result.items.map(toPlantingDto),
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
    const bedId = dto.bedId ?? null;
    if (bedId) await this.requireBedInGarden(gardenId, bedId);

    if (dto.id) {
      const existing = await this.plantings.getById(dto.id);
      if (existing) {
        if (existing.gardenId !== gardenId) throw PLANTING_ERRORS.idInUse();
        return { created: false, list: await this.list(userId, gardenId) };
      }
    }

    await this.plantings.insert({
      id: dto.id,
      gardenId,
      plantId: dto.plantId,
      bedId,
      plantedOn,
      harvestedOn,
      clientMutationId: dto.clientMutationId,
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
    if (dto.bedId) await this.requireBedInGarden(gardenId, dto.bedId);
    const updated = await this.plantings.update(gardenId, plantingId, {
      plantedOn: dto.plantedOn,
      harvestedOn: dto.harvestedOn,
      bedId: dto.bedId,
      clientMutationId: dto.clientMutationId,
    });
    if (!updated) throw PLANTING_ERRORS.plantingNotFound();
    const row = await this.plantings.getInGarden(gardenId, plantingId);
    if (!row) throw PLANTING_ERRORS.plantingNotFound();
    return toPlantingDto(row);
  }

  async remove(userId: string, gardenId: string, plantingId: string): Promise<void> {
    await this.requirePlantingEditor(userId, gardenId);
    const deleted = await this.plantings.delete(gardenId, plantingId);
    if (!deleted) throw PLANTING_ERRORS.plantingNotFound();
  }

  async createBed(
    userId: string,
    gardenId: string,
    dto: BedCreateDto,
  ): Promise<{ created: boolean; bed: NamedBedDto }> {
    await this.requireBedEditor(userId, gardenId);
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
    const row = await this.beds.insert({
      id: dto.id,
      gardenId,
      name: names.name,
      nameNormalized: names.nameNormalized,
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
    const row = await this.beds.rename(gardenId, bedId, names.name, names.nameNormalized);
    if (!row) throw PLANTING_ERRORS.bedNotFound();
    return toBedDto(row);
  }

  async deleteBed(userId: string, gardenId: string, bedId: string): Promise<void> {
    await this.requireBedEditor(userId, gardenId);
    const deleted = await this.beds.delete(gardenId, bedId);
    if (!deleted) throw PLANTING_ERRORS.bedNotFound();
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
}

function toBedDto(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): NamedBedDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
  createdAt: Date;
  updatedAt: Date;
}): PlantingDto {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
