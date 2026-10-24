import type { CompanionKind, SeasonDto } from '@open-garden/shared-types';
import type {
  GardenMembershipRepository,
  PlantRepository,
  YearRecordRepository,
} from '@open-garden/plant-catalog-data';
import { domainError, PLANTING_ERRORS } from './domain-error';

export class SeasonService {
  constructor(
    private readonly memberships: GardenMembershipRepository,
    private readonly years: YearRecordRepository,
    private readonly plants: PlantRepository,
  ) {}

  async get(userId: string, gardenId: string): Promise<SeasonDto> {
    await this.requireMember(userId, gardenId);
    return this.years.snapshot(gardenId);
  }

  async close(userId: string, gardenId: string): Promise<SeasonDto> {
    await this.requireEditor(userId, gardenId);
    await this.years.close(gardenId);
    return this.years.snapshot(gardenId);
  }

  async addPair(
    userId: string,
    gardenId: string,
    input: { plantId: string; otherPlantId: string; kind: CompanionKind; reason: string },
  ): Promise<SeasonDto> {
    await this.requireEditor(userId, gardenId);
    if (input.plantId === input.otherPlantId) {
      throw domainError('VALIDATION_ERROR', 'Pick two different plants');
    }
    const [left, right] = await Promise.all([
      this.plants.getById(input.plantId),
      this.plants.getById(input.otherPlantId),
    ]);
    if (!left || !right) throw PLANTING_ERRORS.plantNotFound();
    await this.years.addPair({
      gardenId,
      plantId: input.plantId,
      otherPlantId: input.otherPlantId,
      kind: input.kind,
      reason: input.reason.trim(),
    });
    return this.years.snapshot(gardenId);
  }

  private async requireMember(userId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
  }

  private async requireEditor(userId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw PLANTING_ERRORS.viewerPlantings();
  }
}
