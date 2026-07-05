import type { GardenAreaType, MeasurementUnit, PlacementStatus } from "@/lib/garden/enums";
import type { GardenDetail, GardenPlantRef, GardenSummary } from "@/lib/garden/types";

export const GARDEN_ZONE_TYPES = [
  "vegetable_garden",
  "orchard",
  "container_patio",
] as const;
export type GardenZoneType = (typeof GARDEN_ZONE_TYPES)[number];

export const STRUCTURE_CATEGORIES = [
  "bed_frame",
  "container",
  "protection",
  "vertical",
  "access",
  "amenity",
  "other",
] as const;
export type StructureCategory = (typeof STRUCTURE_CATEGORIES)[number];

export const ILLUSTRATION_CATEGORIES = [
  "vegetable",
  "herb",
  "fruit",
  "tree",
  "flower",
  "default",
] as const;
export type IllustrationCategory = (typeof ILLUSTRATION_CATEGORIES)[number];

export interface IllustrationRef {
  url: string;
  is_fallback: boolean;
}

export interface StructureTypeRef {
  slug: string;
  name: string;
  category: StructureCategory;
  illustration_url: string;
  environment_tag: string | null;
}

export interface GardenStructure {
  id: string;
  structure_type: StructureTypeRef;
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  rotation_degrees: number;
  z_index: number;
  locked: boolean;
}

export interface VisualPlantPlacement {
  id: string;
  bed_area_id: string;
  plant: GardenPlantRef;
  position_x: number;
  position_y: number;
  status: PlacementStatus;
  planted_on: string;
  spacing_radius: number;
  illustration_url: string;
  rootstock_id: string | null;
  z_index: number;
  locked: boolean;
}

export interface VisualGardenDetail extends Omit<GardenDetail, "structures" | "placements"> {
  zone_type: GardenZoneType;
  visual_version: number;
  thumbnail_url: string | null;
  structures: GardenStructure[];
  placements: VisualPlantPlacement[];
}

export interface VisualGardenSummary extends GardenSummary {
  zone_type: GardenZoneType;
  visual_version: number;
  thumbnail_url: string | null;
}

export type CanvasLayerKind = "structure" | "placement";

export interface CanvasLayerItem {
  id: string;
  kind: CanvasLayerKind;
  z_index: number;
  locked: boolean;
}
