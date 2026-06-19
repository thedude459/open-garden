import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { plantRelationships, rootstockOptions } from "@/lib/db/schema/reference";
import { eq } from "drizzle-orm";
import type { PlantDetail, PlantRef, RootstockOption } from "./types";
import { buildPlantDetailFromCanonical } from "./plant-detail";

export async function getPlantById(id: string, userId?: string): Promise<PlantDetail | null> {
  const [plant] = await db.select().from(canonicalPlants).where(eq(canonicalPlants.id, id)).limit(1);
  if (!plant) {
    return null;
  }

  const relationships = await getRelationships(id);
  const rootstocks = await getRootstocks(id);

  return buildPlantDetailFromCanonical(plant, relationships, rootstocks, userId);
}

export async function getRelationships(plantId: string) {
  const rows = await db
    .select({
      id: canonicalPlants.id,
      commonName: canonicalPlants.commonName,
      relationshipType: plantRelationships.relationshipType,
    })
    .from(plantRelationships)
    .innerJoin(canonicalPlants, eq(plantRelationships.targetPlantId, canonicalPlants.id))
    .where(eq(plantRelationships.sourcePlantId, plantId));

  const companions: PlantRef[] = [];
  const incompatibles: PlantRef[] = [];

  for (const row of rows) {
    const ref: PlantRef = {
      id: row.id,
      common_name: row.commonName,
      relationship_type: row.relationshipType,
    };
    if (row.relationshipType === "companion") {
      companions.push(ref);
    } else {
      incompatibles.push(ref);
    }
  }

  return { plant_id: plantId, companions, incompatibles };
}

export async function getRootstocks(plantId: string): Promise<RootstockOption[]> {
  const rows = await db
    .select()
    .from(rootstockOptions)
    .where(eq(rootstockOptions.plantId, plantId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    vigor: row.vigor,
    mature_height_cm: row.matureHeightCm,
    mature_spread_cm: row.matureSpreadCm,
    spacing_cm: row.spacingCm,
    notes: row.notes,
  }));
}

export { searchPlants } from "./search";
