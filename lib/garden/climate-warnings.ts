import { isClimateCompatible } from "@/lib/catalog/climate-filter";
import { getUserLocation } from "@/lib/catalog/geocode";
import { getPlantById } from "@/lib/catalog/query";
import type { PlantDetail } from "@/lib/catalog/types";
import type { PlantProvenance } from "./enums";
import type { ValidationWarning } from "./types";

export type PlantingDateContext = "direct_seed" | "indoor_start" | "transplant";

function parseDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function weeksDifference(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (7 * 86400000));
}

interface DateWindow {
  start: Date;
  end: Date;
}

function resolveDateWindow(
  context: PlantingDateContext,
  plant: Pick<
    PlantDetail,
    | "seed_start_window"
    | "direct_seed_rules"
    | "transplant_rules"
    | "location_context"
    | "hardiness_min_zone"
    | "hardiness_max_zone"
  >,
  lastFrostDate: string | null,
): DateWindow | null {
  if (!lastFrostDate) {
    return null;
  }

  const frost = parseDate(lastFrostDate);

  if (context === "direct_seed") {
    const rules = plant.direct_seed_rules;
    if (rules && typeof rules.weeks_after_last_frost === "number") {
      const target = addWeeks(frost, rules.weeks_after_last_frost);
      return { start: addWeeks(target, -1), end: addWeeks(target, 2) };
    }

    const window = plant.seed_start_window;
    if (
      window &&
      typeof window.start_week === "number" &&
      typeof window.end_week === "number"
    ) {
      return {
        start: addWeeks(frost, -window.end_week),
        end: addWeeks(frost, -window.start_week),
      };
    }

    return { start: frost, end: addWeeks(frost, 8) };
  }

  if (context === "indoor_start") {
    const window = plant.seed_start_window;
    if (
      window &&
      typeof window.start_week === "number" &&
      typeof window.end_week === "number"
    ) {
      return {
        start: addWeeks(frost, -window.end_week),
        end: addWeeks(frost, -window.start_week),
      };
    }

    if (plant.location_context?.recommended_seed_start) {
      const recommended = parseDate(plant.location_context.recommended_seed_start);
      return { start: addWeeks(recommended, -2), end: addWeeks(frost, -2) };
    }

    return { start: addWeeks(frost, -10), end: addWeeks(frost, -2) };
  }

  const rules = plant.transplant_rules;
  if (rules && typeof rules.weeks_before_last_frost === "number") {
    const target = addWeeks(frost, -rules.weeks_before_last_frost);
    return { start: addWeeks(target, -2), end: addWeeks(frost, 2) };
  }

  if (plant.location_context?.recommended_transplant) {
    const target = parseDate(plant.location_context.recommended_transplant);
    return { start: addWeeks(target, -2), end: addWeeks(target, 4) };
  }

  return { start: addWeeks(frost, -1), end: addWeeks(frost, 6) };
}

export async function resolveClimateWarnings(
  userId: string,
  plantId: string,
  provenance: PlantProvenance,
  plantingDate: string,
  context: PlantingDateContext,
): Promise<ValidationWarning[]> {
  if (provenance !== "authoritative") {
    return [];
  }

  const plant = await getPlantById(plantId, userId);
  if (!plant) {
    return [];
  }

  const warnings: ValidationWarning[] = [];
  const location = await getUserLocation(userId);

  if (location && !isClimateCompatible(
    {
      hardinessMinZone: plant.hardiness_min_zone,
      hardinessMaxZone: plant.hardiness_max_zone,
      seedStartWindow: plant.seed_start_window,
    },
    location,
  )) {
    warnings.push({
      code: "CLIMATE_DATE",
      message: "This plant may not be suitable for your USDA hardiness zone.",
    });
  }

  const window = resolveDateWindow(context, plant, location?.last_frost_date ?? null);
  if (!window) {
    return warnings;
  }

  const date = parseDate(plantingDate);
  if (date < window.start) {
    const weeks = Math.abs(weeksDifference(date, window.start));
    warnings.push({
      code: "CLIMATE_DATE",
      message: `Planting date is about ${weeks} week(s) before the recommended window for your zone.`,
    });
  } else if (date > window.end) {
    const weeks = Math.abs(weeksDifference(window.end, date));
    warnings.push({
      code: "CLIMATE_DATE",
      message: `Planting date is about ${weeks} week(s) after the recommended window for your zone.`,
    });
  }

  return warnings;
}
