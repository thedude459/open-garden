import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { getPlantById } from "@/lib/catalog/query";
import type { PlantCategory } from "@/lib/catalog/enums";
import type { ValidationWarning } from "./types";
import { isOrchardTreeCategory } from "./orchard";

export const GUILD_UNDERSTORY_CATEGORIES: PlantCategory[] = [
  "guild_plant",
  "herb",
  "berry",
  "shrub",
  "cover_crop",
  "companion_flower",
];

export interface OrchardAdvisory {
  plant_id: string;
  common_name: string;
  kind: "companion" | "understory";
  rationale: string;
}

async function getUnderstoryPlantSuggestions(limit: number): Promise<OrchardAdvisory[]> {
  const rows = await db
    .select({
      id: canonicalPlants.id,
      commonName: canonicalPlants.commonName,
      plantCategory: canonicalPlants.plantCategory,
    })
    .from(canonicalPlants)
    .where(inArray(canonicalPlants.plantCategory, GUILD_UNDERSTORY_CATEGORIES))
    .limit(limit);

  return rows.map((row) => ({
    plant_id: row.id,
    common_name: row.commonName,
    kind: "understory" as const,
    rationale: `${row.commonName} is a typical understory or guild-layer choice in orchard plans.`,
  }));
}

export async function getOrchardAdvisories(
  plantId: string,
  rootstockId?: string | null,
): Promise<OrchardAdvisory[]> {
  const plant = await getPlantById(plantId);
  if (!plant || !isOrchardTreeCategory(plant.plant_category)) {
    return [];
  }

  const advisories: OrchardAdvisory[] = plant.companions.map((companion) => ({
    plant_id: companion.id,
    common_name: companion.common_name,
    kind: "companion",
    rationale: `Catalog lists ${companion.common_name} as a companion for ${plant.common_name}.`,
  }));

  const understory = await getUnderstoryPlantSuggestions(Math.max(0, 6 - advisories.length));
  advisories.push(...understory);

  if (rootstockId && plant.rootstocks.length > 0) {
    const rootstock = plant.rootstocks.find((option) => option.id === rootstockId);
    if (rootstock) {
      advisories.unshift({
        plant_id: plantId,
        common_name: rootstock.name,
        kind: "companion",
        rationale: `${rootstock.name} rootstock spacing is ${rootstock.spacing_cm ?? "catalog-default"} cm — plan canopy clearance accordingly.`,
      });
    }
  }

  return advisories.slice(0, 8);
}

export function orchardAdvisoriesToWarnings(advisories: OrchardAdvisory[]): ValidationWarning[] {
  return advisories.map((advisory) => ({
    code: advisory.kind === "companion" ? "ORCHARD_COMPANION" : "ORCHARD_GUILD",
    message:
      advisory.kind === "companion"
        ? `Companion suggestion: ${advisory.common_name} — ${advisory.rationale}`
        : `Understory guild idea: ${advisory.common_name} — ${advisory.rationale}`,
  }));
}
