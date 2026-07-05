import { getPlantById, getRootstocks } from "@/lib/catalog/query";
import type { PlantCategory } from "@/lib/catalog/enums";
import type { RootstockOption } from "@/lib/catalog/types";
import type { GardenZoneType, MeasurementUnit, PlantProvenance } from "./enums";
import { spacingRadiusFromCm } from "./spacing";
import type { GardenDetail, PlantPlacement } from "./types";

export const ORCHARD_TREE_CATEGORIES: PlantCategory[] = ["fruit_tree", "nut_tree"];

export function isOrchardTreeCategory(category: PlantCategory | string): boolean {
  return ORCHARD_TREE_CATEGORIES.includes(category as PlantCategory);
}

export function resolveCanopySpacingCm(
  rootstocks: RootstockOption[],
  rootstockId: string | null | undefined,
  plantSpacingCm: number | null,
  matureSpreadCm: number | null,
): { spacingCm: number | null; requiresRootstock: boolean } {
  if (rootstocks.length === 0) {
    return { spacingCm: plantSpacingCm ?? matureSpreadCm, requiresRootstock: false };
  }

  if (!rootstockId) {
    return { spacingCm: null, requiresRootstock: true };
  }

  const rootstock = rootstocks.find((option) => option.id === rootstockId);
  if (!rootstock) {
    return { spacingCm: null, requiresRootstock: true };
  }

  const spacingCm =
    rootstock.spacing_cm ??
    (rootstock.mature_spread_cm != null ? rootstock.mature_spread_cm : null) ??
    plantSpacingCm ??
    matureSpreadCm;

  return { spacingCm, requiresRootstock: false };
}

export async function resolveOrchardCanopyRadius(
  plantId: string,
  provenance: PlantProvenance,
  rootstockId: string | null | undefined,
  userId: string,
  unit: MeasurementUnit,
): Promise<{ radius: number | null; requiresRootstock: boolean; isTree: boolean }> {
  if (provenance !== "authoritative") {
    return { radius: null, requiresRootstock: false, isTree: false };
  }

  const plant = await getPlantById(plantId, userId);
  if (!plant || !isOrchardTreeCategory(plant.plant_category)) {
    return { radius: null, requiresRootstock: false, isTree: false };
  }

  const plantSpacingCm =
    plant.spacing_cm?.plant ?? plant.spacing_cm?.row ?? null;
  const matureSpreadCm = plant.rootstocks[0]?.mature_spread_cm ?? null;
  const { spacingCm, requiresRootstock } = resolveCanopySpacingCm(
    plant.rootstocks,
    rootstockId,
    plantSpacingCm,
    matureSpreadCm,
  );

  return {
    radius: spacingRadiusFromCm(spacingCm, unit),
    requiresRootstock,
    isTree: true,
  };
}

export async function resolvePlacementCanopyRadius(
  placement: Pick<PlantPlacement, "plant" | "rootstock_id">,
  zoneType: GardenZoneType | undefined,
  userId: string,
  unit: MeasurementUnit,
  defaultRadius: number,
): Promise<number> {
  if (zoneType !== "orchard") {
    return defaultRadius;
  }

  const orchard = await resolveOrchardCanopyRadius(
    placement.plant.id,
    placement.plant.provenance,
    placement.rootstock_id,
    userId,
    unit,
  );

  return orchard.radius ?? defaultRadius;
}

export interface ZoneChangeConflict {
  placement_id: string;
  message: string;
}

export async function findZoneChangeConflicts(
  garden: GardenDetail,
  newZoneType: GardenZoneType,
  userId: string,
): Promise<ZoneChangeConflict[]> {
  const currentZone = garden.zone_type ?? "vegetable_garden";
  if (currentZone === newZoneType) {
    return [];
  }

  const conflicts: ZoneChangeConflict[] = [];

  for (const placement of garden.placements) {
    if (newZoneType === "container_patio" && placement.plant.provenance === "authoritative") {
      const plant = await getPlantById(placement.plant.id, userId);
      if (plant && isOrchardTreeCategory(plant.plant_category)) {
        conflicts.push({
          placement_id: placement.id,
          message: `${placement.plant.common_name} is not suited to a container / patio plan`,
        });
      }
    }

    if (currentZone === "orchard" && placement.rootstock_id) {
      conflicts.push({
        placement_id: placement.id,
        message: `${placement.plant.common_name} uses orchard rootstock settings that do not apply to ${newZoneType.replace("_", " ")} plans`,
      });
    }
  }

  return conflicts;
}

export class ZoneChangeConflictError extends Error {
  readonly name = "ZoneChangeConflictError";

  constructor(public readonly conflicts: ZoneChangeConflict[]) {
    super("Zone type change affects existing placements");
  }
}
