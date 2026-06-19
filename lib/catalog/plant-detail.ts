import type { CanonicalPlant } from "@/lib/db/schema/plants";
import type { PlantDetail, PlantRef, RootstockOption } from "./types";
import { getUserLocation } from "./geocode";

function fieldGapsFromPlant(plant: CanonicalPlant): string[] {
  const gaps: string[] = [];
  if (!plant.botanicalName) gaps.push("botanical_name");
  if (!plant.daysToMaturity) gaps.push("days_to_maturity");
  if (!plant.spacingCm) gaps.push("spacing_cm");
  if (!plant.sunExposure) gaps.push("sun_exposure");
  if (!plant.fertilizerNeeds) gaps.push("fertilizer_needs");
  if (plant.fertilizerDataGap) gaps.push("fertilizer_data_gap");
  return gaps;
}

function provenanceFromStatus(status: CanonicalPlant["recordStatus"]) {
  if (status === "stub") return "stub" as const;
  return "authoritative" as const;
}

export async function buildPlantDetailFromCanonical(
  plant: CanonicalPlant,
  relationships: { companions: PlantRef[]; incompatibles: PlantRef[] },
  rootstocks: RootstockOption[],
  userId?: string,
): Promise<PlantDetail> {
  const location = userId ? await getUserLocation(userId) : null;

  return {
    id: plant.id,
    provenance: provenanceFromStatus(plant.recordStatus),
    botanical_name: plant.botanicalName,
    common_name: plant.commonName,
    variety: plant.variety,
    plant_category: plant.plantCategory,
    days_to_maturity: plant.daysToMaturity,
    seed_start_window: (plant.seedStartWindow as Record<string, unknown> | null) ?? null,
    transplant_rules: (plant.transplantRules as Record<string, unknown> | null) ?? null,
    direct_seed_rules: (plant.directSeedRules as Record<string, unknown> | null) ?? null,
    spacing_cm: (plant.spacingCm as { row?: number; plant?: number } | null) ?? null,
    sun_exposure: plant.sunExposure,
    watering_needs: (plant.wateringNeeds as Record<string, unknown> | null) ?? null,
    fertilizer_needs: plant.fertilizerNeeds,
    fertilizer_data_gap: plant.fertilizerDataGap ?? false,
    pest_disease_notes: (plant.pestDiseaseNotes as string[] | null) ?? [],
    harvest_window: (plant.harvestWindow as Record<string, unknown> | null) ?? null,
    hardiness_min_zone: plant.hardinessMinZone,
    hardiness_max_zone: plant.hardinessMaxZone,
    field_gaps: fieldGapsFromPlant(plant),
    companions: relationships.companions,
    incompatibles: relationships.incompatibles,
    rootstocks,
    location_context: location
      ? {
          recommended_seed_start: location.last_frost_date
            ? new Date(new Date(location.last_frost_date).getTime() - 42 * 86400000)
                .toISOString()
                .slice(0, 10)
            : null,
          recommended_transplant: location.last_frost_date ?? null,
        }
      : null,
  };
}
