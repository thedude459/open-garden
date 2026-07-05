import { areasOverlap, isPointInBed, isWithinBounds } from "./geometry";
import { isOrchardTreeCategory, resolveOrchardCanopyRadius } from "./orchard";
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
import type { GardenZoneType, PlantProvenance, RotationDegrees } from "./enums";
import { getPlantById } from "@/lib/catalog/query";

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
  rootstock_id?: string | null;
  exclude_placement_id?: string;
}

async function effectiveSpacingRadius(
  garden: GardenDetail,
  plantId: string,
  provenance: PlantProvenance,
  rootstockId: string | null | undefined,
  userId: string,
  defaultRadius: number,
): Promise<{ radius: number | null; requiresRootstock: boolean; isTree: boolean }> {
  const zoneType = (garden.zone_type ?? "vegetable_garden") as GardenZoneType;

  if (zoneType === "orchard") {
    const orchard = await resolveOrchardCanopyRadius(
      plantId,
      provenance,
      rootstockId,
      userId,
      garden.unit,
    );
    if (orchard.isTree) {
      return orchard;
    }
  }

  return { radius: defaultRadius, requiresRootstock: false, isTree: false };
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

  const candidateOrchard = await effectiveSpacingRadius(
    garden,
    candidate.plant_id,
    candidate.plant_provenance,
    candidate.rootstock_id,
    userId,
    candidatePlant.spacing_radius,
  );

  if (candidateOrchard.requiresRootstock) {
    violations.push({
      code: "TREE_SPACING",
      message: `Select a rootstock for ${candidatePlant.common_name} before placing in an orchard plan`,
    });
    return { valid: false, violations, warnings: [] };
  }

  const candidateRadius = candidateOrchard.radius ?? candidatePlant.spacing_radius;

  const incompatibleIds = await resolveIncompatiblePlantIds(
    candidate.plant_id,
    candidate.plant_provenance,
  );

  const spacingCache = new Map<string, number | null>();

  async function spacingRadiusFor(placement: PlantPlacement): Promise<number | null> {
    const cacheKey = `${placement.plant.provenance}:${placement.plant.id}:${placement.rootstock_id ?? ""}`;
    if (spacingCache.has(cacheKey)) {
      return spacingCache.get(cacheKey) ?? null;
    }
    const resolved = await resolvePlantSpacing(
      placement.plant.id,
      placement.plant.provenance,
      userId,
      garden.unit,
    );
    const baseRadius = resolved?.spacing_radius ?? null;
    const orchard = await effectiveSpacingRadius(
      garden,
      placement.plant.id,
      placement.plant.provenance,
      placement.rootstock_id,
      userId,
      baseRadius ?? 0,
    );
    const radius = orchard.radius ?? baseRadius;
    spacingCache.set(cacheKey, radius);
    return radius;
  }

  for (const placement of garden.placements) {
    if (candidate.exclude_placement_id && placement.id === candidate.exclude_placement_id) {
      continue;
    }

    const otherRadius = (await spacingRadiusFor(placement)) ?? placement.spacing_radius;
    if (otherRadius == null) {
      continue;
    }

    const minDistance = Math.max(candidateRadius, otherRadius);
    const actualDistance = distance(
      candidate.position_x,
      candidate.position_y,
      placement.position_x,
      placement.position_y,
    );

    const zoneType = garden.zone_type ?? "vegetable_garden";
    let otherIsTree = false;
    if (zoneType === "orchard" && placement.plant.provenance === "authoritative") {
      const otherPlant = await getPlantById(placement.plant.id, userId);
      otherIsTree = otherPlant ? isOrchardTreeCategory(otherPlant.plant_category) : false;
    }
    const treeSpacingViolation =
      zoneType === "orchard" && (candidateOrchard.isTree || otherIsTree);

    if (actualDistance < minDistance) {
      violations.push({
        code: treeSpacingViolation ? "TREE_SPACING" : "SPACING",
        message: treeSpacingViolation
          ? `Too close to ${placement.plant.common_name} (tree canopy spacing)`
          : `Too close to ${placement.plant.common_name}`,
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

export interface StructureBounds {
  id: string;
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  rotation_degrees: RotationDegrees;
}

export function validateStructureGeometry(
  candidate: RectAreaInput,
  garden: GardenBounds,
  existingStructures: StructureBounds[],
  excludeStructureId?: string,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!isWithinBounds(candidate, garden)) {
    violations.push({
      code: "BOUNDARY",
      message: "Structure extends outside the garden boundary",
    });
  }

  for (const existing of existingStructures) {
    if (excludeStructureId && existing.id === excludeStructureId) {
      continue;
    }
    if (areasOverlap(candidate, toRect(existing))) {
      violations.push({
        code: "OVERLAP",
        message: "Overlaps with another structure",
      });
    }
  }

  return violations;
}

export function assertValidStructureGeometry(
  candidate: RectAreaInput,
  garden: GardenBounds,
  existingStructures: StructureBounds[],
  excludeStructureId?: string,
): void {
  const violations = validateStructureGeometry(
    candidate,
    garden,
    existingStructures,
    excludeStructureId,
  );
  if (violations.length > 0) {
    throw new AreaGeometryError(violations);
  }
}

