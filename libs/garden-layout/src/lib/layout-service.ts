import {
  AREA_KINDS,
  mulchOrNone,
  type AreaKind,
  type BedGeometryDto,
  type BedOrientation,
  type GardenLayoutDto,
  type LayoutBedDto,
  type GardenRole,
  type LayoutAreaDto,
  type LayoutPutDto,
  type PlantStatus,
  type PlantType,
  type SoilPhDto,
  type StartMethod,
  type Transaction,
  gardenAccess,
} from '@open-garden/shared-types';
import type {
  AreaRepository,
  BedRepository,
  GardenMembershipRepository,
  PlantingRepository,
  SoilTestRepository,
  YearRecordRepository,
} from '@open-garden/plant-catalog-data';
import { LAYOUT_ERRORS } from './domain-error';
import { assertCompleteGeometry } from './geometry';
import { evaluateLayout } from './evaluate-layout';
import { spacingInchesFor } from './placement-notes';

function normalizeAreaName(raw: string): { name: string; nameNormalized: string } {
  const name = raw.trim();
  if (!name) throw LAYOUT_ERRORS.areaNameRequired();
  if (name.length > 120) throw LAYOUT_ERRORS.areaNameTooLong();
  return { name, nameNormalized: name.toLowerCase() };
}

/** What a layout save writes, inside one transaction. */
export interface LayoutWrites {
  beds: Pick<BedRepository, 'setGeometry'>;
  plantings: Pick<PlantingRepository, 'clearLayoutCoords' | 'clearPlacement' | 'setPlacement'>;
  areas: Pick<AreaRepository, 'upsert'>;
}

/** Every dependency is required and typed as the slice this service uses. */
export class LayoutService {
  constructor(
    private readonly memberships: Pick<GardenMembershipRepository, 'get'>,
    // Layout writes go through `transaction` only, so these read.
    private readonly plantings: Pick<PlantingRepository, 'listAllForLayout'>,
    private readonly beds: Pick<BedRepository, 'listByGarden'>,
    private readonly areas: Pick<AreaRepository, 'delete' | 'listByGarden'>,
    private readonly years: Pick<YearRecordRepository, 'currentYear' | 'layoutAdvice'>,
    private readonly soilTests: Pick<SoilTestRepository, 'latestByGarden'>,
    /** The property's typed areas: only each one's id and kind are read. */
    private readonly plantingAreas: {
      listByGarden(gardenId: string): Promise<{ id: string; kind: string }[]>;
    },
    /** A layout save writes beds, placements, and areas; all of it or none. */
    private readonly transaction: Transaction<LayoutWrites>,
  ) {}

  /**
   * The plan of a season (ADR 0040): the current one, or the next, which is
   * planned while this one grows. Beds and areas are the property's and the
   * same in both; plantings are the season's annuals and every perennial.
   */
  async get(userId: string, gardenId: string, season?: number): Promise<GardenLayoutDto> {
    const membership = await this.memberships.get(gardenId, userId);
    if (!membership) throw LAYOUT_ERRORS.gardenNotFound();
    const seasons = await this.seasons(gardenId, season);
    return this.snapshot(gardenId, membership.role as GardenRole, seasons);
  }

  async put(
    userId: string,
    gardenId: string,
    dto: LayoutPutDto,
    season?: number,
  ): Promise<GardenLayoutDto> {
    const membership = gardenAccess(
      await this.memberships.get(gardenId, userId),
      'edit',
      LAYOUT_ERRORS.viewerLayout,
    );
    const seasons = await this.seasons(gardenId, season);

    // Only this season's plantings are placed, checked for spacing, or
    // taken off the plan when missing; the other season's are left alone.
    // ponytail: bed geometry is shared, so resizing a bed in one season does
    // not re-check the other season's plants; checking both would need a
    // second evaluation.
    const [bedRows, plantingRows, areaRows] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listAllForLayout(gardenId, seasons.query),
      this.areas.listByGarden(gardenId),
    ]);
    const bedIds = new Set(bedRows.map((b) => b.id));
    const plantingIds = new Set(plantingRows.map((p) => p.id));

    for (const bed of dto.beds) {
      if (!bedIds.has(bed.id)) throw LAYOUT_ERRORS.bedNotFound();
      assertCompleteGeometry(bed);
    }
    const sizedIds = new Set(dto.beds.map((b) => b.id));
    for (const placement of dto.placements) {
      if (!plantingIds.has(placement.plantingId)) throw LAYOUT_ERRORS.plantingNotFound();
      if (!sizedIds.has(placement.bedId) && !bedIds.has(placement.bedId)) {
        throw LAYOUT_ERRORS.bedNotFound();
      }
    }

    const areaIdByName = new Map(areaRows.map((area) => [area.nameNormalized, area.id]));
    const seenNames = new Map<string, string>();
    for (const area of dto.areas ?? []) {
      const names = normalizeAreaName(area.name);
      const takenId = seenNames.get(names.nameNormalized);
      if (takenId && takenId !== area.id) throw LAYOUT_ERRORS.areaNameTaken();
      seenNames.set(names.nameNormalized, area.id);
      const existingId = areaIdByName.get(names.nameNormalized);
      if (existingId && existingId !== area.id) throw LAYOUT_ERRORS.areaNameTaken();
      if (area.lengthInches < 1 || area.widthInches < 1) throw LAYOUT_ERRORS.sizeMin();
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
          : toGeometry(row),
      };
    });
    const proposedPlantings = plantingRows.map((row) => {
      const put = dto.placements.find((p) => p.plantingId === row.id);
      return {
        id: row.id,
        spacingInches: row.spacingInches,
        placement: put ? { bedId: put.bedId, xInches: put.xInches, yInches: put.yInches } : null,
      };
    });
    const saved = {
      beds: bedRows.map((row) => ({ id: row.id, geometry: toGeometry(row) })),
      plantings: plantingRows.map((row) => ({
        id: row.id,
        spacingInches: row.spacingInches,
        placement:
          row.bedId !== null && row.layoutXInches !== null && row.layoutYInches !== null
            ? { bedId: row.bedId, xInches: row.layoutXInches, yInches: row.layoutYInches }
            : null,
      })),
    };
    const flags = evaluateLayout(proposedBeds, proposedPlantings, saved);
    if (flags.some((f) => f.blocking)) throw LAYOUT_ERRORS.spacingProblems();

    await this.transaction(async ({ beds, plantings, areas }) => {
      await Promise.all(
        bedRows.flatMap((row) => {
          const put = dto.beds.find((b) => b.id === row.id);
          return put ? [beds.setGeometry(gardenId, row.id, put)] : [];
        }),
      );
      await Promise.all(
        plantingRows.map(async (row) => {
          const put = dto.placements.find((p) => p.plantingId === row.id);
          if (put) {
            await plantings.setPlacement(gardenId, row.id, {
              bedId: put.bedId,
              xInches: put.xInches,
              yInches: put.yInches,
            });
            return;
          }
          if (row.layoutXInches === null) return;
          const startMethod = (row as { startMethod?: string }).startMethod ?? 'direct_seed';
          if (startMethod === 'transplant') {
            await plantings.clearPlacement(gardenId, row.id);
          } else {
            await plantings.clearLayoutCoords(gardenId, row.id);
          }
        }),
      );

      await Promise.all(
        (dto.areas ?? []).map((area) => {
          const names = normalizeAreaName(area.name);
          return areas.upsert(gardenId, {
            id: area.id,
            name: names.name,
            nameNormalized: names.nameNormalized,
            originXInches: area.originXInches,
            originYInches: area.originYInches,
            lengthInches: area.lengthInches,
            widthInches: area.widthInches,
          });
        }),
      );
    });

    return this.snapshot(gardenId, membership.role as GardenRole, seasons);
  }

  /**
   * The season asked for and the current one. Only the current season and
   * the next may be planned. `query` is undefined for the current season,
   * so a property that never closed one keeps its earlier years' annuals.
   */
  private async seasons(gardenId: string, season?: number) {
    const current = await this.years.currentYear(gardenId);
    const year = season ?? current;
    if (year !== current && year !== current + 1) throw LAYOUT_ERRORS.seasonOutOfRange();
    return { year, current, query: year === current ? undefined : year };
  }

  async deleteArea(userId: string, gardenId: string, areaId: string): Promise<void> {
    gardenAccess(await this.memberships.get(gardenId, userId), 'edit', LAYOUT_ERRORS.viewerLayout);
    const deleted = await this.areas.delete(gardenId, areaId);
    if (!deleted) throw LAYOUT_ERRORS.areaNotFound();
  }

  private async snapshot(
    gardenId: string,
    role: GardenRole,
    seasons: { year: number; current: number; query: number | undefined },
  ): Promise<GardenLayoutDto> {
    const [bedRows, plantingRows, areaRows] = await Promise.all([
      this.beds.listByGarden(gardenId),
      this.plantings.listAllForLayout(gardenId, seasons.query),
      this.areas.listByGarden(gardenId),
    ]);
    const [advice, soilTests, plantingAreaRows] = await Promise.all([
      this.years.layoutAdvice(gardenId, seasons.year),
      this.soilTests.latestByGarden(gardenId),
      this.plantingAreas.listByGarden(gardenId),
    ]);
    const areaKinds = new Map(plantingAreaRows.map((row) => [row.id, row.kind]));
    const beds = bedRows.map((row): LayoutBedDto => ({
      id: row.id,
      name: row.name,
      geometry: toGeometry(row),
      sun: row.sun === 'full' || row.sun === 'part' || row.sun === 'shade' ? row.sun : null,
      site: row.site === 'raised' ? 'raised' : 'in_ground',
      station: row.station === 'tree' ? 'tree' : row.station === 'berry' ? 'berry' : null,
      mulch: mulchOrNone(row.mulch),
      areaId: row.areaId,
      areaKind: toAreaKind(areaKinds.get(row.areaId)),
      soilTest: soilTests.beds.get(row.id) ?? null,
    }));
    const plantings = plantingRows.map((row) => {
      const placed = row.layoutXInches !== null && row.layoutYInches !== null && row.bedId !== null;
      return {
        id: row.id,
        plantId: row.plantId,
        commonName: row.commonName,
        species: row.species,
        cultivar: row.cultivar,
        plantType: row.plantType as PlantType,
        status: row.status as PlantStatus,
        bedId: row.bedId,
        spacingInches: spacingInchesFor(
          (row as { spacingFeet?: number | null }).spacingFeet,
          row.spacingInches,
        ),
        spacingFeet: (row as { spacingFeet?: number | null }).spacingFeet ?? null,
        sunRequirements: (row as { sunRequirements?: string | null }).sunRequirements ?? null,
        family: (row as { family?: string | null }).family ?? null,
        soilPh: soilPhOf(row),
        life: ((row as { life?: string }).life ?? 'annual') as 'annual' | 'perennial' | 'tree',
        startMethod: ((row as { startMethod?: string }).startMethod ??
          'direct_seed') as StartMethod,
        indoorStartedOn: (row as { indoorStartedOn?: string | null }).indoorStartedOn ?? null,
        plannedOn: (row as { plannedOn?: string | null }).plannedOn ?? null,
        plantedOn: (row as { plantedOn?: string | null }).plantedOn ?? null,
        trayId: (row as { trayId?: string | null }).trayId ?? null,
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
    const areas: LayoutAreaDto[] = areaRows.map((row) => ({
      id: row.id,
      name: row.name,
      originXInches: row.originXInches,
      originYInches: row.originYInches,
      lengthInches: row.lengthInches,
      widthInches: row.widthInches,
    }));
    return {
      gardenId,
      myRole: role,
      seasonYear: seasons.year,
      currentSeasonYear: seasons.current,
      beds,
      areas,
      plantings,
      // Stored layout: anything flagged here was saved, so nothing blocks.
      flags: evaluateLayout(beds, plantings, { beds, plantings }),
      priorCrops: advice.prior,
      pairs: advice.pairs,
      areaSoilTests: [...soilTests.areas.values()],
    };
  }
}

function soilPhOf(row: { soilPhMin?: number | null; soilPhMax?: number | null }): SoilPhDto | null {
  return row.soilPhMin != null && row.soilPhMax != null
    ? { min: row.soilPhMin, max: row.soilPhMax }
    : null;
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

/** An area's type as stored; an unknown one counts as a vegetable garden. */
function toAreaKind(kind: string | undefined): AreaKind {
  return (AREA_KINDS as readonly string[]).includes(kind ?? '') ? (kind as AreaKind) : 'vegetable';
}
