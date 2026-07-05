import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gardenStructures, structureTypes } from "@/lib/db/schema";
import type { GardenDetail, GardenStructureSummary, GardenSummary } from "@/lib/garden/types";
import type { GardenZoneType } from "@/lib/garden/enums";
import { resolvePlantIllustration, resolveStructureIllustration } from "./illustrations";
import { projectGardenForVisualPlanner, thumbnailUrlFromKey } from "./migration";
import type { GardenStructure, VisualGardenDetail } from "./types";

interface GardenVisualMeta {
  zoneType: GardenZoneType;
  visualVersion: number;
  thumbnailKey: string | null;
}

interface PlacementVisualMeta {
  id: string;
  rootstockId: string | null;
  zIndex: number;
  locked: boolean;
}

export async function loadGardenStructures(gardenId: string): Promise<GardenStructure[]> {
  const rows = await db
    .select({ structure: gardenStructures, type: structureTypes })
    .from(gardenStructures)
    .innerJoin(structureTypes, eq(gardenStructures.structureTypeId, structureTypes.id))
    .where(eq(gardenStructures.gardenId, gardenId));

  return rows.map(({ structure, type }) => ({
    id: structure.id,
    structure_type: {
      slug: type.slug,
      name: type.name,
      category: type.category,
      illustration_url: resolveStructureIllustration(type.illustrationPath),
      environment_tag: type.environmentTag,
    },
    origin_x: parseFloat(structure.originX),
    origin_y: parseFloat(structure.originY),
    length: parseFloat(structure.length),
    width: parseFloat(structure.width),
    rotation_degrees: structure.rotationDegrees,
    z_index: structure.zIndex,
    locked: structure.locked,
  }));
}

export async function enrichGardenDetail(
  detail: GardenDetail,
  meta: GardenVisualMeta,
  placementMeta: PlacementVisualMeta[],
): Promise<VisualGardenDetail> {
  const structures = await loadGardenStructures(detail.id);
  const placementIllustrations = new Map<string, string>();
  const placementMetaMap = new Map<
    string,
    { rootstock_id: string | null; z_index: number; locked: boolean }
  >();

  for (const row of placementMeta) {
    placementMetaMap.set(row.id, {
      rootstock_id: row.rootstockId,
      z_index: row.zIndex,
      locked: row.locked,
    });
  }

  for (const placement of detail.placements) {
    const illustration = await resolvePlantIllustration(
      placement.plant.id,
      placement.plant.provenance,
    );
    placementIllustrations.set(placement.id, illustration.url);
  }

  return projectGardenForVisualPlanner(detail, {
    zone_type: meta.zoneType,
    visual_version: meta.visualVersion,
    thumbnail_url: thumbnailUrlFromKey(detail.id, meta.thumbnailKey),
    structures,
    placementIllustrations,
    placementMeta: placementMetaMap,
  });
}

export function enrichGardenSummary(
  summary: GardenSummary,
  meta: GardenVisualMeta,
): GardenSummary {
  return {
    ...summary,
    zone_type: meta.zoneType,
    visual_version: meta.visualVersion,
    thumbnail_url: thumbnailUrlFromKey(summary.id, meta.thumbnailKey),
  };
}

export function mapStructuresToSummary(structures: GardenStructure[]): GardenStructureSummary[] {
  return structures.map((structure) => ({
    id: structure.id,
    structure_type_slug: structure.structure_type.slug,
    structure_type_name: structure.structure_type.name,
    origin_x: structure.origin_x,
    origin_y: structure.origin_y,
    length: structure.length,
    width: structure.width,
    rotation_degrees: structure.rotation_degrees,
    z_index: structure.z_index,
    locked: structure.locked,
    illustration_url: structure.structure_type.illustration_url,
  }));
}
