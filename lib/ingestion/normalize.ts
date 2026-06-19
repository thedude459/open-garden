import type { TreflePlant } from "./trefle-client";
import type { PerenualPlant } from "./perenual-client";
import { filterOrganicFertilizer } from "./fertilizer-filter";
import type { PlantCategory, SunExposure } from "@/lib/catalog/enums";
import type { NewCanonicalPlant } from "@/lib/db/schema/plants";

function mapSunExposure(sunlight: string[] | undefined): SunExposure | null {
  const joined = (sunlight ?? []).join(" ").toLowerCase();
  if (joined.includes("full")) return "full";
  if (joined.includes("part")) return "partial";
  if (joined.includes("shade")) return "shade";
  return null;
}

function inferCategory(commonName: string): PlantCategory {
  const name = commonName.toLowerCase();
  if (name.includes("tree")) return "fruit_tree";
  if (name.includes("herb") || ["basil", "mint", "oregano", "thyme"].some((h) => name.includes(h))) {
    return "herb";
  }
  return "vegetable";
}

export function normalizeTreflePlant(plant: TreflePlant): Omit<NewCanonicalPlant, "id"> {
  const commonName = plant.common_name ?? plant.scientific_name;
  return {
    commonName,
    botanicalName: plant.scientific_name,
    plantCategory: inferCategory(commonName),
    recordStatus: "authoritative" as const,
    variety: null,
    daysToMaturity: null,
    sunExposure: null,
    fertilizerNeeds: null,
    fertilizerDataGap: true,
    dataCompleteness: { source: "trefle" },
  };
}

export function normalizePerenualPlant(plant: PerenualPlant): Omit<NewCanonicalPlant, "id"> {
  const fertilizer = filterOrganicFertilizer(
    plant.watering ? `Water ${plant.watering}; use compost for feeding` : null,
  );

  const minZone = plant.hardiness?.min ? Number.parseInt(plant.hardiness.min, 10) : null;
  const maxZone = plant.hardiness?.max ? Number.parseInt(plant.hardiness.max, 10) : null;

  return {
    commonName: plant.common_name,
    botanicalName: plant.scientific_name?.[0] ?? plant.common_name,
    plantCategory: inferCategory(plant.common_name),
    recordStatus: "authoritative" as const,
    variety: null,
    daysToMaturity: null,
    sunExposure: mapSunExposure(plant.sunlight),
    wateringNeeds: plant.watering ? { frequency: plant.watering } : null,
    fertilizerNeeds: fertilizer.value,
    fertilizerDataGap: fertilizer.dataGap,
    hardinessMinZone: Number.isFinite(minZone) ? minZone : null,
    hardinessMaxZone: Number.isFinite(maxZone) ? maxZone : null,
    dataCompleteness: { source: "perenual" },
  };
}
