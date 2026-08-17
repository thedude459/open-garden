import type {
  BedGeometryDto,
  BedOrientation,
  GardenLayoutDto,
  GardenRole,
  LayoutPutDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';
import type {
  BedRepository,
  GardenMembershipRepository,
  PlantingRepository,
} from '@open-garden/plant-catalog-data';
import { LAYOUT_ERRORS } from './domain-error';
import { assertCompleteGeometry } from './geometry';
import { evaluateLayout } from './evaluate-layout';

export class LayoutService {
  constructor(
    private readonly memberships: GardenMembershipRepository,
    private readonly plantings: PlantingRepository,
    private readonly beds: BedRepository,
  ) {}

  async get(userId: string, gardenId: string): Promise<GardenLayoutDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw LAYOUT_ERRORS.gardenNotFound();
    return this.snapshot(gardenId, membership.role as GardenRole);
  }

  async put(userId: string, gardenId: string, dto: LayoutPutDto): Promise<GardenLayoutDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw LAYOUT_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw LAYOUT_ERRORS.viewerLayout();

    const bedRows = await this.beds.listByGarden(gardenId);
    const plantingRows = await this.plantings.listAllForLayout(gardenId);
    const bedIds = new Set(bedRows.map((b) => b.id));
    const plantingIds = new Set(plantingRows.map((p) => p.id));

    for (const bed of dto.beds) {
      if (!bedIds.has(bed.id)) throw LAYOUT_ERRORS.bedNotFound();
      assertCompleteGeometry(bed);
    }
    const sizedIds = new Set(dto.beds.map((b) => b.id));
    for (const placement of dto.placements) {
      if (!plantingIds.has(placement.plantingId)) throw LAYOUT_ERRORS.plantingNotFound();
      if (!sizedIds.has(placement.bedId)) throw LAYOUT_ERRORS.bedNotFound();
    }

    const proposedBeds = bedRows.map((row) => {
      const put = dto.beds.find((b) => b.id === row.id);
      return {
        id: row.id,
        name: row.name,
        geometry: put
          ? {
              originXInches: put.originXInches,
              originYInches: put.originYInches,
              lengthInches: put.lengthInches,
              widthInches: put.widthInches,
              orientation: put.orientation,
            }
          : null,
      };
    });
    const proposedPlantings = plantingRows.map((row) => {
      const put = dto.placements.find((p) => p.plantingId === row.id);
      return {
        id: row.id,
        spacingInches: row.spacingInches,
        placement: put
          ? { bedId: put.bedId, xInches: put.xInches, yInches: put.yInches }
          : null,
      };
    });
    const flags = evaluateLayout(proposedBeds, proposedPlantings);
    if (flags.some((f) => f.blocking)) throw LAYOUT_ERRORS.spacingProblems();

    for (const row of bedRows) {
      const put = dto.beds.find((b) => b.id === row.id);
      if (put) {
        await this.beds.setGeometry(gardenId, row.id, put);
      } else if (row.originXInches !== null) {
        await this.beds.clearGeometry(gardenId, row.id);
      }
    }
    for (const row of plantingRows) {
      const put = dto.placements.find((p) => p.plantingId === row.id);
      if (put) {
        await this.plantings.setPlacement(gardenId, row.id, {
          bedId: put.bedId,
          xInches: put.xInches,
          yInches: put.yInches,
        });
      } else if (row.layoutXInches !== null) {
        await this.plantings.clearLayoutCoords(gardenId, row.id);
      }
    }

    return this.snapshot(gardenId, membership.role as GardenRole);
  }

  private async snapshot(gardenId: string, role: GardenRole): Promise<GardenLayoutDto> {
    const [bedRows, plantingRows] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listAllForLayout(gardenId),
    ]);
    const beds = bedRows.map((row) => ({
      id: row.id,
      name: row.name,
      geometry: toGeometry(row),
    }));
    const plantings = plantingRows.map((row) => {
      const placed =
        row.layoutXInches !== null && row.layoutYInches !== null && row.bedId !== null;
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
        placement: placed
          ? {
              plantingId: row.id,
              bedId: row.bedId!,
              xInches: row.layoutXInches!,
              yInches: row.layoutYInches!,
            }
          : null,
      };
    });
    return {
      gardenId,
      myRole: role,
      beds,
      plantings,
      flags: evaluateLayout(beds, plantings),
    };
  }
}

function toGeometry(row: {
  originXInches: number | null;
  originYInches: number | null;
  lengthInches: number | null;
  widthInches: number | null;
  orientation: number;
}): BedGeometryDto | null {
  if (
    row.originXInches === null ||
    row.originYInches === null ||
    row.lengthInches === null ||
    row.widthInches === null
  ) {
    return null;
  }
  return {
    originXInches: row.originXInches,
    originYInches: row.originYInches,
    lengthInches: row.lengthInches,
    widthInches: row.widthInches,
    orientation: row.orientation as BedOrientation,
  };
}
