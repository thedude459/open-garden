import { gardenAccess } from '@open-garden/shared-types';
import type { SoilTestCreateDto, SoilTestDto, SoilTestOwner } from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  SoilTestRepository,
} from '@open-garden/plant-catalog-data';
import { domainError, PLANTING_ERRORS } from './domain-error';

type Memberships = Pick<GardenMembershipRepository, 'get'>;
type Beds = Pick<BedRepository, 'getInGarden'>;
type Areas = Pick<PlantingAreaRepository, 'getInGarden'>;
type Tests = Pick<SoilTestRepository, 'insert' | 'delete' | 'latestFor'>;

/**
 * Recording soil tests of an area or a bed (ADR 0033). Members who can change
 * beds can record them. A greenhouse grows in trays, so it takes no test.
 */
export class SoilTestService {
  constructor(
    private readonly memberships: Memberships,
    private readonly areas: Areas,
    private readonly beds: Beds,
    private readonly tests: Tests,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(
    userId: string,
    gardenId: string,
    owner: SoilTestOwner,
    input: SoilTestCreateDto,
  ): Promise<SoilTestDto> {
    await this.requireOwner(userId, gardenId, owner);
    // A day of slack, so a test dated in a time zone ahead of UTC is not refused.
    const tomorrow = new Date(this.now().getTime() + 86_400_000).toISOString().slice(0, 10);
    if (input.testedOn > tomorrow) {
      throw domainError('VALIDATION_ERROR', 'The test date cannot be in the future');
    }
    return this.tests.insert(owner, input);
  }

  /** Deletes a test entered by mistake, and returns its owner's latest test now. */
  async remove(
    userId: string,
    gardenId: string,
    owner: SoilTestOwner,
    testId: string,
  ): Promise<{ latest: SoilTestDto | null }> {
    await this.requireOwner(userId, gardenId, owner);
    if (!(await this.tests.delete(owner, testId))) {
      throw domainError('NOT_FOUND', 'Soil test not found');
    }
    return { latest: await this.tests.latestFor(owner) };
  }

  private async requireOwner(userId: string, gardenId: string, owner: SoilTestOwner) {
    gardenAccess(await this.memberships.get(gardenId, userId), 'edit', PLANTING_ERRORS.viewerBeds);
    if ('bedId' in owner) {
      if (!(await this.beds.getInGarden(gardenId, owner.bedId))) {
        throw PLANTING_ERRORS.bedNotFound();
      }
      return;
    }
    const area = await this.areas.getInGarden(gardenId, owner.areaId);
    if (!area) throw domainError('NOT_FOUND', 'Area not found');
    if (area.kind === 'greenhouse') {
      throw domainError('VALIDATION_ERROR', 'A greenhouse grows in trays; test a bed instead');
    }
  }
}
