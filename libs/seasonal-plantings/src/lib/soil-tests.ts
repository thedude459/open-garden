import type { SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  SoilTestRepository,
} from '@open-garden/plant-catalog-data';
import { domainError, PLANTING_ERRORS } from './domain-error';

type Memberships = Pick<GardenMembershipRepository, 'get'>;
type Beds = Pick<BedRepository, 'getInGarden'>;
type Tests = Pick<SoilTestRepository, 'insert' | 'delete' | 'latestForBed'>;

/** Recording a bed's soil tests (ADR 0033). Members who can change beds can record them. */
export class SoilTestService {
  constructor(
    private readonly memberships: Memberships,
    private readonly beds: Beds,
    private readonly tests: Tests,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(
    userId: string,
    gardenId: string,
    bedId: string,
    input: SoilTestCreateDto,
  ): Promise<SoilTestDto> {
    await this.requireBed(userId, gardenId, bedId);
    // A day of slack, so a test dated in a time zone ahead of UTC is not refused.
    const tomorrow = new Date(this.now().getTime() + 86_400_000).toISOString().slice(0, 10);
    if (input.testedOn > tomorrow) {
      throw domainError('VALIDATION_ERROR', 'The test date cannot be in the future');
    }
    return this.tests.insert(bedId, input);
  }

  /** Deletes a test entered by mistake, and returns the bed's latest test now. */
  async remove(
    userId: string,
    gardenId: string,
    bedId: string,
    testId: string,
  ): Promise<{ latest: SoilTestDto | null }> {
    await this.requireBed(userId, gardenId, bedId);
    if (!(await this.tests.delete(bedId, testId))) {
      throw domainError('NOT_FOUND', 'Soil test not found');
    }
    return { latest: await this.tests.latestForBed(bedId) };
  }

  private async requireBed(userId: string, gardenId: string, bedId: string) {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw PLANTING_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw PLANTING_ERRORS.viewerBeds();
    if (!(await this.beds.getInGarden(gardenId, bedId))) throw PLANTING_ERRORS.bedNotFound();
  }
}
