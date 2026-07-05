import type { PlantCategory } from "@/lib/catalog/enums";
import type { PlantProvenance } from "@/lib/garden/enums";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  canonicalPlants,
  illustrationCategoryDefaults,
  plantIllustrations,
} from "@/lib/db/schema";
import type { IllustrationCategory, IllustrationRef } from "./types";

const STATIC_DEFAULT = "/planner/categories/default.svg";

export function illustrationPathToUrl(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return `/${path.replace(/^public\//, "")}`;
}

export function mapPlantCategoryToIllustration(
  category: PlantCategory | string | null | undefined,
): IllustrationCategory {
  switch (category) {
    case "vegetable":
    case "cover_crop":
      return "vegetable";
    case "herb":
      return "herb";
    case "fruit":
    case "berry":
      return "fruit";
    case "fruit_tree":
    case "nut_tree":
    case "shrub":
      return "tree";
    case "companion_flower":
    case "guild_plant":
      return "flower";
    default:
      return "default";
  }
}

export function resolveCategoryDefault(category: IllustrationCategory): string {
  return `/planner/categories/${category}.svg`;
}

async function resolveCategoryDefaultFromDb(
  category: IllustrationCategory,
): Promise<string> {
  const [row] = await db
    .select({ path: illustrationCategoryDefaults.illustrationPath })
    .from(illustrationCategoryDefaults)
    .where(eq(illustrationCategoryDefaults.category, category))
    .limit(1);

  if (row) {
    return illustrationPathToUrl(row.path);
  }
  return resolveCategoryDefault(category);
}

export async function resolvePlantIllustration(
  plantId: string,
  provenance: PlantProvenance,
): Promise<IllustrationRef> {
  if (provenance === "authoritative") {
    const [specific] = await db
      .select({ path: plantIllustrations.illustrationPath })
      .from(plantIllustrations)
      .where(eq(plantIllustrations.canonicalPlantId, plantId))
      .limit(1);

    if (specific) {
      return { url: illustrationPathToUrl(specific.path), is_fallback: false };
    }

    const [plant] = await db
      .select({ category: canonicalPlants.plantCategory })
      .from(canonicalPlants)
      .where(eq(canonicalPlants.id, plantId))
      .limit(1);

    const illCategory = mapPlantCategoryToIllustration(plant?.category);
    const fallbackUrl = await resolveCategoryDefaultFromDb(illCategory);
    return { url: fallbackUrl, is_fallback: true };
  }

  const fallbackUrl = await resolveCategoryDefaultFromDb("default");
  return { url: fallbackUrl, is_fallback: true };
}

export function resolveStructureIllustration(illustrationPath: string): string {
  return illustrationPathToUrl(illustrationPath);
}

/** Synchronous fallback when DB defaults are unavailable (tests). */
export function resolvePlantIllustrationSync(
  provenance: PlantProvenance,
  category?: PlantCategory | string | null,
): IllustrationRef {
  if (provenance !== "authoritative") {
    return { url: STATIC_DEFAULT, is_fallback: true };
  }
  const illCategory = mapPlantCategoryToIllustration(category);
  return { url: resolveCategoryDefault(illCategory), is_fallback: true };
}
