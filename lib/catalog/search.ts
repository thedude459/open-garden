import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { userProvisionalPlants } from "@/lib/db/schema/user-data";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import type { PlantCategory } from "./enums";
import type { PlantSummary, SearchResult } from "./types";
import { filterByClimate } from "./climate-filter";
import { getUserLocation } from "./geocode";

export interface SearchParams {
  q?: string;
  category?: PlantCategory;
  sun?: "full" | "partial" | "shade";
  spacingMin?: number;
  climateFilter?: boolean;
  userId: string;
  limit?: number;
  offset?: number;
}

function toSummary(
  plant: typeof canonicalPlants.$inferSelect,
  provenance: PlantSummary["provenance"] = "authoritative",
): PlantSummary {
  return {
    id: plant.id,
    common_name: plant.commonName,
    botanical_name: plant.botanicalName,
    variety: plant.variety,
    plant_category: plant.plantCategory,
    days_to_maturity: plant.daysToMaturity,
    provenance,
    field_gaps: [],
  };
}

export async function searchPlants(params: SearchParams): Promise<SearchResult> {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;

  const conditions = [];
  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        ilike(canonicalPlants.commonName, pattern),
        ilike(canonicalPlants.botanicalName, pattern),
      ),
    );
  }
  if (params.category) {
    conditions.push(eq(canonicalPlants.plantCategory, params.category));
  }
  if (params.sun) {
    conditions.push(eq(canonicalPlants.sunExposure, params.sun));
  }
  if (params.spacingMin) {
    conditions.push(
      sql`(${canonicalPlants.spacingCm}->>'plant')::int >= ${params.spacingMin}`,
    );
  }

  let plants = await db
    .select()
    .from(canonicalPlants)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(500);

  let climateFilterActive = false;
  if (params.climateFilter) {
    const location = await getUserLocation(params.userId);
    if (!location?.usda_zone) {
      throw new Error("NO_LOCATION");
    }
    climateFilterActive = true;
    plants = filterByClimate(plants, { usda_zone: location.usda_zone });
  }

  const provisionals = await db
    .select()
    .from(userProvisionalPlants)
    .where(
      and(
        eq(userProvisionalPlants.userId, params.userId),
        params.q ? ilike(userProvisionalPlants.commonName, `%${params.q}%`) : undefined,
      ),
    );

  const provisionalSummaries: PlantSummary[] = provisionals.map((p) => ({
    id: p.id,
    common_name: p.commonName,
    botanical_name: null,
    variety: null,
    plant_category: p.plantCategory,
    days_to_maturity: p.daysToMaturity,
    provenance: p.linkStatus === "linked" ? "linked_provisional" : "provisional",
    field_gaps: [],
  }));

  const canonicalSummaries = plants.map((p) =>
    toSummary(p, p.recordStatus === "stub" ? "stub" : "authoritative"),
  );

  const combined = [...canonicalSummaries, ...provisionalSummaries];
  const page = combined.slice(offset, offset + limit);

  return {
    results: page,
    total: combined.length,
    climate_filter_active: climateFilterActive,
  };
}
