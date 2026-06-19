import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { userProvisionalPlants } from "@/lib/db/schema/user-data";
import { and, eq } from "drizzle-orm";
import { getPlantById } from "./query";

export async function linkProvisionalToCanonical(
  userId: string,
  provisionalId: string,
  canonicalPlantId: string,
) {
  const provisional = await db
    .select()
    .from(userProvisionalPlants)
    .where(
      and(
        eq(userProvisionalPlants.id, provisionalId),
        eq(userProvisionalPlants.userId, userId),
      ),
    )
    .limit(1);

  if (!provisional[0] || provisional[0].linkStatus !== "link_offered") {
    throw new Error("NO_LINK_OFFER");
  }

  const [canonical] = await db
    .select()
    .from(canonicalPlants)
    .where(eq(canonicalPlants.id, canonicalPlantId))
    .limit(1);

  if (!canonical) {
    throw new Error("CANONICAL_NOT_FOUND");
  }

  await db
    .update(userProvisionalPlants)
    .set({
      linkedCanonicalId: canonicalPlantId,
      linkStatus: "linked",
      updatedAt: new Date(),
    })
    .where(eq(userProvisionalPlants.id, provisionalId));

  const detail = await getPlantById(canonicalPlantId, userId);
  if (!detail) {
    throw new Error("CANONICAL_NOT_FOUND");
  }

  return {
    ...detail,
    provenance: "linked_provisional" as const,
    common_name: provisional[0].commonName,
    spacing_cm:
      (provisional[0].spacingCm as { row?: number; plant?: number }) ?? detail.spacing_cm,
    days_to_maturity: provisional[0].daysToMaturity ?? detail.days_to_maturity,
  };
}

export async function scanProvisionalMatches() {
  const offers = await db
    .select()
    .from(userProvisionalPlants)
    .where(eq(userProvisionalPlants.linkStatus, "provisional"));

  let updated = 0;
  for (const provisional of offers) {
    const [match] = await db
      .select()
      .from(canonicalPlants)
      .where(eq(canonicalPlants.commonName, provisional.commonName))
      .limit(1);

    if (match) {
      await db
        .update(userProvisionalPlants)
        .set({ linkStatus: "link_offered", updatedAt: new Date() })
        .where(eq(userProvisionalPlants.id, provisional.id));
      updated += 1;
    }
  }

  return updated;
}
