import type { PlantCategory } from "@/lib/catalog/enums";
import type { GardenZoneType } from "@/lib/garden/enums";

const VEGETABLE_GARDEN_CATEGORIES: PlantCategory[] = [
  "vegetable",
  "herb",
  "fruit",
  "berry",
  "cover_crop",
  "companion_flower",
  "guild_plant",
  "shrub",
];

const ORCHARD_CATEGORIES: PlantCategory[] = [
  "fruit_tree",
  "nut_tree",
  "shrub",
  "guild_plant",
  "herb",
  "berry",
  "fruit",
  "cover_crop",
  "companion_flower",
];

const CONTAINER_CATEGORIES: PlantCategory[] = [
  "vegetable",
  "herb",
  "fruit",
  "berry",
  "shrub",
  "companion_flower",
];

export const ZONE_PLANT_CATEGORIES: Record<GardenZoneType, PlantCategory[]> = {
  vegetable_garden: VEGETABLE_GARDEN_CATEGORIES,
  orchard: ORCHARD_CATEGORIES,
  container_patio: CONTAINER_CATEGORIES,
};

export function isPlantCategoryAllowedInZone(
  category: PlantCategory,
  zoneType: GardenZoneType,
): boolean {
  return ZONE_PLANT_CATEGORIES[zoneType].includes(category);
}

export function zoneTypeLabel(zoneType: GardenZoneType): string {
  switch (zoneType) {
    case "vegetable_garden":
      return "Vegetable garden";
    case "orchard":
      return "Orchard";
    case "container_patio":
      return "Container / patio";
  }
}
