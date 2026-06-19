import { db } from "@/lib/db/client";
import { userProvisionalPlants } from "@/lib/db/schema/user-data";
import { eq, and } from "drizzle-orm";
import type { PlantCategory } from "./enums";

export async function listProvisionals(userId: string) {
  return db
    .select()
    .from(userProvisionalPlants)
    .where(eq(userProvisionalPlants.userId, userId));
}

export async function createProvisional(
  userId: string,
  input: {
    common_name: string;
    plant_category: PlantCategory;
    spacing_cm: { row?: number; plant?: number };
    days_to_maturity: number;
    optional_fields?: Record<string, unknown>;
  },
) {
  const [row] = await db
    .insert(userProvisionalPlants)
    .values({
      userId,
      commonName: input.common_name,
      plantCategory: input.plant_category,
      spacingCm: input.spacing_cm,
      daysToMaturity: input.days_to_maturity,
      optionalFields: input.optional_fields ?? {},
    })
    .returning();

  return row;
}

export async function getProvisional(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(userProvisionalPlants)
    .where(and(eq(userProvisionalPlants.id, id), eq(userProvisionalPlants.userId, userId)))
    .limit(1);

  return row ?? null;
}
