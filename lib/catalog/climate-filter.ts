import type { CanonicalPlant } from "@/lib/db/schema/plants";
import type { ResolvedLocation } from "./geocode";

export function isClimateCompatible(
  plant: Pick<CanonicalPlant, "hardinessMinZone" | "hardinessMaxZone" | "seedStartWindow">,
  location: ResolvedLocation | { usda_zone: number | null },
): boolean {
  const userZone = "usdaZone" in location ? location.usdaZone : location.usda_zone;
  if (userZone == null) {
    return true;
  }

  if (plant.hardinessMinZone != null && plant.hardinessMinZone > userZone) {
    return false;
  }

  if (plant.hardinessMaxZone != null && plant.hardinessMaxZone < userZone) {
    return false;
  }

  return true;
}

export function filterByClimate<T extends Pick<CanonicalPlant, "hardinessMinZone" | "hardinessMaxZone" | "seedStartWindow">>(
  plants: T[],
  location: ResolvedLocation | { usda_zone: number | null } | null,
): T[] {
  if (!location) {
    return plants;
  }
  return plants.filter((plant) => isClimateCompatible(plant, location));
}
