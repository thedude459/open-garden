import type { PlantDetail } from "@/lib/catalog/types";

export type PlantingMethod = "direct_seed" | "indoor_start";

export interface PlantingMethodSupport {
  direct_seed: boolean;
  indoor_start: boolean;
  direct_seed_disabled_reason?: string;
  indoor_start_disabled_reason?: string;
}

export function resolvePlantingMethods(
  plant: Pick<PlantDetail, "direct_seed_rules" | "transplant_rules" | "seed_start_window"> | null,
): PlantingMethodSupport {
  if (!plant) {
    return { direct_seed: true, indoor_start: true };
  }

  const hasDirectSeed = plant.direct_seed_rules != null;
  const hasIndoorPath =
    plant.transplant_rules != null || plant.seed_start_window != null;

  if (!hasDirectSeed && hasIndoorPath) {
    return {
      direct_seed: false,
      indoor_start: true,
      direct_seed_disabled_reason:
        "This plant is typically started indoors and transplanted.",
    };
  }

  if (hasDirectSeed && !hasIndoorPath) {
    return {
      direct_seed: true,
      indoor_start: false,
      indoor_start_disabled_reason: "This plant is direct-seeded only.",
    };
  }

  return { direct_seed: true, indoor_start: true };
}

export function assertPlantingMethodAllowed(
  plant: Pick<PlantDetail, "direct_seed_rules" | "transplant_rules" | "seed_start_window"> | null,
  method: PlantingMethod,
): void {
  const support = resolvePlantingMethods(plant);
  if (method === "direct_seed" && !support.direct_seed) {
    throw new PlantingMethodError(
      support.direct_seed_disabled_reason ?? "Direct seed is not supported for this plant.",
    );
  }
  if (method === "indoor_start" && !support.indoor_start) {
    throw new PlantingMethodError(
      support.indoor_start_disabled_reason ?? "Indoor start is not supported for this plant.",
    );
  }
}

export class PlantingMethodError extends Error {
  readonly name = "PlantingMethodError";

  constructor(message: string) {
    super(message);
  }
}
