import { getPlantById, getRelationships } from "@/lib/catalog/query";
import { getProvisional } from "@/lib/catalog/provisionals";
import type { MeasurementUnit, PlantProvenance } from "./enums";
import {
  resolvePlantSpacingCm,
  resolvePlantSpacingRadius,
  spacingRadiusFromCm,
} from "./spacing";

export interface ResolvedPlantSpacing {
  plant_id: string;
  provenance: PlantProvenance;
  common_name: string;
  spacing_cm: number | null;
  spacing_radius: number | null;
}

export async function resolvePlantSpacing(
  plantId: string,
  provenance: PlantProvenance,
  userId: string,
  unit: MeasurementUnit,
): Promise<ResolvedPlantSpacing | null> {
  if (provenance === "authoritative") {
    const plant = await getPlantById(plantId, userId);
    if (!plant) {
      return null;
    }
    const spacingCm = resolvePlantSpacingCm(plant);
    return {
      plant_id: plantId,
      provenance,
      common_name: plant.common_name,
      spacing_cm: spacingCm,
      spacing_radius: resolvePlantSpacingRadius(plant, unit),
    };
  }

  const provisional = await getProvisional(userId, plantId);
  if (!provisional) {
    return null;
  }

  const spacingCm = resolvePlantSpacingCm({
    spacing_cm: provisional.spacingCm as { row?: number; plant?: number },
  });

  return {
    plant_id: plantId,
    provenance,
    common_name: provisional.commonName,
    spacing_cm: spacingCm,
    spacing_radius: spacingRadiusFromCm(spacingCm, unit),
  };
}

export async function resolveIncompatiblePlantIds(
  plantId: string,
  provenance: PlantProvenance,
): Promise<Set<string>> {
  if (provenance !== "authoritative") {
    return new Set();
  }
  const relationships = await getRelationships(plantId);
  return new Set(relationships.incompatibles.map((plant) => plant.id));
}
