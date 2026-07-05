import type { GardenDetail } from "@/lib/garden/types";
import type { GardenStructure, GardenZoneType, VisualGardenDetail } from "./types";

export interface VisualProjectionInput {
  zone_type: GardenZoneType;
  visual_version: number;
  thumbnail_url: string | null;
  structures: GardenStructure[];
  placementIllustrations: Map<string, string>;
  placementMeta: Map<
    string,
    { rootstock_id: string | null; z_index: number; locked: boolean }
  >;
}

/**
 * Maps a 002 GardenDetail into visual planner shape with illustration URLs.
 * Idempotent — safe to call on every load for visual_version=0 gardens.
 */
export function projectGardenForVisualPlanner(
  detail: GardenDetail,
  input: VisualProjectionInput,
): VisualGardenDetail {
  return {
    ...detail,
    zone_type: input.zone_type,
    visual_version: input.visual_version,
    thumbnail_url: input.thumbnail_url,
    structures: input.structures,
    placements: detail.placements.map((placement) => {
      const meta = input.placementMeta.get(placement.id) ?? {
        rootstock_id: null,
        z_index: 0,
        locked: false,
      };
      return {
        ...placement,
        illustration_url:
          input.placementIllustrations.get(placement.id) ??
          "/planner/categories/default.svg",
        rootstock_id: meta.rootstock_id,
        z_index: meta.z_index,
        locked: meta.locked,
      };
    }),
  };
}

export function needsVisualUpgrade(visualVersion: number): boolean {
  return visualVersion === 0;
}

export function thumbnailUrlFromKey(
  gardenId: string,
  thumbnailKey: string | null | undefined,
): string | null {
  if (!thumbnailKey) {
    return null;
  }
  if (thumbnailKey.startsWith("/")) {
    return thumbnailKey;
  }
  return `/planner/thumbnails/${gardenId}.webp`;
}
