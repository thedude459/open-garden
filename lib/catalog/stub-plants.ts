import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { eq } from "drizzle-orm";
import type { PlantCategory } from "./enums";

export async function createStubPlant(input: {
  commonName: string;
  plantCategory: PlantCategory;
}) {
  const [plant] = await db
    .insert(canonicalPlants)
    .values({
      commonName: input.commonName,
      plantCategory: input.plantCategory,
      recordStatus: "stub",
      dataCompleteness: { stub: true },
    })
    .returning();

  return plant;
}

export async function getStubPlantByName(commonName: string) {
  const [plant] = await db
    .select()
    .from(canonicalPlants)
    .where(eq(canonicalPlants.commonName, commonName))
    .limit(1);

  return plant ?? null;
}
