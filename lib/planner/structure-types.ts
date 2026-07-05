import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { structureTypes } from "@/lib/db/schema";
import type { GardenZoneType } from "@/lib/garden/enums";
import { resolveStructureIllustration } from "./illustrations";

export interface StructureTypeSummary {
  slug: string;
  name: string;
  category: string;
  default_length: number;
  default_width: number;
  illustration_url: string;
  environment_tag: string | null;
  allowed_zone_types: GardenZoneType[];
}

export async function listStructureTypes(
  zoneType?: GardenZoneType,
): Promise<StructureTypeSummary[]> {
  const rows = await db.select().from(structureTypes);

  return rows
    .filter((row) => !zoneType || row.allowedZoneTypes.includes(zoneType))
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      category: row.category,
      default_length: parseFloat(row.defaultLength),
      default_width: parseFloat(row.defaultWidth),
      illustration_url: resolveStructureIllustration(row.illustrationPath),
      environment_tag: row.environmentTag,
      allowed_zone_types: row.allowedZoneTypes as GardenZoneType[],
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
