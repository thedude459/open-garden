import { areasOverlap, isPointInBed, isWithinBounds } from "./geometry";
import { resolveIncompatiblePlantIds, resolvePlantSpacing } from "./plant-context";
import type {
  GardenArea,
  GardenBounds,
  GardenDetail,
  PlantPlacement,
  RectAreaInput,
  ValidationResult,
  ValidationViolation,
} from "./types";
import type { PlantProvenance } from "./enums";

export class AreaGeometryError extends Error {
  readonly name = "AreaGeometryError";

  constructor(public readonly violations: ValidationViolation[]) {
    super("Area geometry validation failed");
  }
}

export class PlacementValidationError extends Error {
  readonly name = "PlacementValidationError";

  constructor(public readonly violations: ValidationViolation[]) {
    super("Placement validation failed");
  }
}

export class LayoutShrinkError extends Error {
  readonly name = "LayoutShrinkError";

  constructor(public readonly affectedPlacementIds: string[]) {
    super("Layout change affects existing plant placements");
  }
}

export interface PlacementCandidateInput {
  bed_area_id: string;
  plant_id: string;
  plant_provenance: PlantProvenance;
  position_x: number;
  position_y: number;
  exclude_placement_id?: string;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function toRect(area: Pick<GardenArea, "origin_x" | "origin_y" | "length" | "width" | "rotation_degrees">): RectAreaInput {
  return {
    origin_x: area.origin_x,
    origin_y: area.origin_y,
    length: area.length,
    width: area.width,
    rotation_degrees: area.rotation_degrees,
  };
}

export function validateAreaGeometry(
  candidate: RectAreaInput,
  garden: GardenBounds,
  existingAreas: GardenArea[],
  excludeAreaId?: string,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!isWithinBounds(candidate, garden)) {
    violations.push({
      code: "BOUNDARY",
      message: "Area extends outside the garden boundary",
    });
  }

  for (const existing of existingAreas) {
    if (excludeAreaId && existing.id === excludeAreaId) {
      continue;
    }
    if (areasOverlap(candidate, toRect(existing))) {
      violations.push({
        code: "OVERLAP",
        message: `Overlaps with ${existing.name ?? existing.area_type}`,
      });
    }
  }

  return violations;
}

export function assertValidAreaGeometry(
  candidate: RectAreaInput,
  garden: GardenBounds,
  existingAreas: GardenArea[],
  excludeAreaId?: string,
): void {
  const violations = validateAreaGeometry(candidate, garden, existingAreas, excludeAreaId);
  if (violations.length > 0) {
    throw new AreaGeometryError(violations);
  }
}

export async function validatePlacement(
  garden: GardenDetail,
  candidate: PlacementCandidateInput,
  userId: string,
): Promise<ValidationResult> {
  const violations: ValidationViolation[] = [];
  const bed = garden.areas.find((area) => area.id === candidate.bed_area_id);

  if (!bed || bed.area_type !== "bed") {
    violations.push({
      code: "BOUNDARY",
      message: "Placement must target a plantable bed",
    });
    return { valid: false, violations, warnings: [] };
  }

  if (!isPointInBed(candidate.position_x, candidate.position_y, toRect(bed))) {
    violations.push({
      code: "BOUNDARY",
      message: "Plant position is outside the selected bed",
    });
  }

  const candidatePlant = await resolvePlantSpacing(
    candidate.plant_id,
    candidate.plant_provenance,
    userId,
    garden.unit,
  );

  if (!candidatePlant) {
    violations.push({
      code: "SPACING",
      message: "Plant not found",
    });
    return { valid: false, violations, warnings: [] };
  }

  if (candidatePlant.spacing_radius == null) {
    violations.push({
      code: "SPACING",
      message: `Missing spacing data for ${candidatePlant.common_name}`,
    });
    return { valid: false, violations, warnings: [] };
  }

  const incompatibleIds = await resolveIncompatiblePlantIds(
    candidate.plant_id,
    candidate.plant_provenance,
  );

  const spacingCache = new Map<string, number | null>();

  async function spacingRadiusFor(placement: PlantPlacement): Promise<number | null> {
    const cacheKey = `${placement.plant.provenance}:${placement.plant.id}`;
    if (spacingCache.has(cacheKey)) {
      return spacingCache.get(cacheKey) ?? null;
    }
    const resolved = await resolvePlantSpacing(
      placement.plant.id,
      placement.plant.provenance,
      userId,
      garden.unit,
    );
    const radius = resolved?.spacing_radius ?? null;
    spacingCache.set(cacheKey, radius);
    return radius;
  }

  for (const placement of garden.placements) {
    if (candidate.exclude_placement_id && placement.id === candidate.exclude_placement_id) {
      continue;
    }

    const otherRadius = placement.spacing_radius || (await spacingRadiusFor(placement));
    if (otherRadius == null) {
      continue;
    }

    const minDistance = Math.max(candidatePlant.spacing_radius, otherRadius);
    const actualDistance = distance(
      candidate.position_x,
      candidate.position_y,
      placement.position_x,
      placement.position_y,
    );

    if (actualDistance < minDistance) {
      violations.push({
        code: "SPACING",
        message: `Too close to ${placement.plant.common_name}`,
        other_placement_id: placement.id,
      });
    }

    if (incompatibleIds.has(placement.plant.id) && actualDistance < minDistance) {
      violations.push({
        code: "INCOMPATIBLE",
        message: `Incompatible with ${placement.plant.common_name}`,
        other_plant_id: placement.plant.id,
        other_placement_id: placement.id,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings: [],
  };
}

export function assertValidPlacement(result: ValidationResult): void {
  if (!result.valid) {
    throw new PlacementValidationError(result.violations);
  }
}

export function findAffectedPlacementsForAreaChange(
  bedAreaId: string,
  proposedBed: RectAreaInput,
  placements: PlantPlacement[],
): string[] {
  return placements
    .filter((placement) => placement.bed_area_id === bedAreaId)
    .filter(
      (placement) =>
        !isPointInBed(placement.position_x, placement.position_y, proposedBed),
    )
    .map((placement) => placement.id);
}

export function findAffectedPlacementsForGardenChange(
  garden: GardenDetail,
  proposedLength: number,
  proposedWidth: number,
): string[] {
  const bounds = { length: proposedLength, width: proposedWidth };

  return garden.placements
    .filter((placement) => {
      if (
        placement.position_x < 0 ||
        placement.position_y < 0 ||
        placement.position_x > proposedLength ||
        placement.position_y > proposedWidth
      ) {
        return true;
      }

      const bed = garden.areas.find((area) => area.id === placement.bed_area_id);
      if (!bed) {
        return true;
      }

      if (!isWithinBounds(toRect(bed), bounds)) {
        return true;
      }

      return !isPointInBed(placement.position_x, placement.position_y, toRect(bed));
    })
    .map((placement) => placement.id);
}

export function assertAreasWithinGarden(
  areas: GardenArea[],
  garden: GardenBounds,
): void {
  const violations: ValidationViolation[] = [];

  for (const area of areas) {
    if (!isWithinBounds(toRect(area), garden)) {
      violations.push({
        code: "BOUNDARY",
        message: `${area.name ?? area.area_type} extends outside the garden boundary`,
      });
    }
  }

  if (violations.length > 0) {
    throw new AreaGeometryError(violations);
  }
}

