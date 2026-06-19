export type { PlantDetail, PlantSummary, SearchResult } from "@/lib/catalog/types";

export interface CacheManifest {
  version: string;
  plant_ids: string[];
  synced_at: string;
}

export interface CacheBundle {
  manifest: CacheManifest;
  plants: import("@/lib/catalog/types").PlantDetail[];
}
