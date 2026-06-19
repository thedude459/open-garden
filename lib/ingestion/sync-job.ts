import { db } from "@/lib/db/client";
import { canonicalPlants, providerPlantSources } from "@/lib/db/schema/plants";
import { catalogSyncRuns } from "@/lib/db/schema/sync";
import { eq } from "drizzle-orm";
import { fetchTreflePlants } from "./trefle-client";
import { fetchPerenualPlants } from "./perenual-client";
import { normalizePerenualPlant, normalizeTreflePlant } from "./normalize";
import { scanProvisionalMatches } from "@/lib/catalog/merge-provisional";
import type { NewCanonicalPlant } from "@/lib/db/schema/plants";

async function runProviderSync(
  provider: "trefle" | "perenual",
  fetchPage: (page: number) => Promise<Array<{ id: number }>>,
  normalize: (item: { id: number }) => Omit<NewCanonicalPlant, "id">,
) {
  const [run] = await db
    .insert(catalogSyncRuns)
    .values({ provider, status: "running" })
    .returning();

  let recordsUpserted = 0;

  try {
    const pageItems = await fetchPage(1);
    for (const item of pageItems) {
      const normalized = normalize(item);
      const [plant] = await db
        .insert(canonicalPlants)
        .values(normalized)
        .returning();

      if (plant) {
        recordsUpserted += 1;
        await db.insert(providerPlantSources).values({
          plantId: plant.id,
          provider,
          externalId: String(item.id),
          lastSyncedAt: new Date(),
        });
      }
    }

    await db
      .update(catalogSyncRuns)
      .set({ status: "success", completedAt: new Date(), recordsUpserted })
      .where(eq(catalogSyncRuns.id, run.id));
  } catch (error) {
    await db
      .update(catalogSyncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(catalogSyncRuns.id, run.id));
    throw error;
  }

  return recordsUpserted;
}

export async function runPlantSync() {
  const trefleCount = await runProviderSync("trefle", fetchTreflePlants, (item) =>
    normalizeTreflePlant(item as Parameters<typeof normalizeTreflePlant>[0]),
  ).catch(() => 0);

  const perenualCount = await runProviderSync("perenual", fetchPerenualPlants, (item) =>
    normalizePerenualPlant(item as Parameters<typeof normalizePerenualPlant>[0]),
  ).catch(() => 0);

  const matches = await scanProvisionalMatches();

  return { trefleCount, perenualCount, matches };
}
