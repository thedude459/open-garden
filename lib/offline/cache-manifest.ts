import { db } from "@/lib/db/client";
import { userGardenPlantRefs, userRecentlyViewed } from "@/lib/db/schema/user-data";
import { eq } from "drizzle-orm";
import { getPlantById } from "@/lib/catalog/query";

export async function buildCacheManifest(userId: string) {
  const pinned = await db
    .select({ plantId: userGardenPlantRefs.plantId })
    .from(userGardenPlantRefs)
    .where(eq(userGardenPlantRefs.userId, userId));

  const recent = await db
    .select({ plantId: userRecentlyViewed.plantId })
    .from(userRecentlyViewed)
    .where(eq(userRecentlyViewed.userId, userId));

  const plantIds = [...new Set([...pinned.map((p) => p.plantId), ...recent.map((r) => r.plantId)])];

  return {
    version: `${Date.now()}`,
    plant_ids: plantIds,
    synced_at: new Date().toISOString(),
  };
}

export async function buildCacheBundle(userId: string) {
  const manifest = await buildCacheManifest(userId);
  const plants = [];

  for (const plantId of manifest.plant_ids) {
    const detail = await getPlantById(plantId, userId);
    if (detail) {
      plants.push(detail);
    }
  }

  return { manifest, plants };
}
