import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { planTemplates } from "@/lib/db/schema";
import type { GardenZoneType } from "@/lib/garden/enums";

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  zone_type: GardenZoneType;
  preview_image_url: string;
}

export interface TemplateLayoutSnapshot {
  areas?: Array<{
    area_type: "bed" | "path";
    name?: string | null;
    origin_x: number;
    origin_y: number;
    length: number;
    width: number;
    rotation_degrees?: number;
  }>;
  structures?: Array<{
    structure_type_slug: string;
    origin_x: number;
    origin_y: number;
    length: number;
    width: number;
    rotation_degrees?: number;
  }>;
  placements?: Array<{
    bed_area_index?: number;
    plant_id?: string;
    position_x: number;
    position_y: number;
    planted_on?: string;
  }>;
}

function previewUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export async function listTemplates(zoneType?: GardenZoneType): Promise<TemplateSummary[]> {
  const rows = await db.select().from(planTemplates).orderBy(planTemplates.sortOrder);

  return rows
    .filter((row) => !zoneType || row.zoneType === zoneType)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      zone_type: row.zoneType as GardenZoneType,
      preview_image_url: previewUrl(row.previewImagePath),
    }));
}

export async function getTemplateById(templateId: string) {
  const [row] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, templateId))
    .limit(1);
  return row ?? null;
}

export function parseLayoutSnapshot(raw: unknown): TemplateLayoutSnapshot {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as TemplateLayoutSnapshot;
}
