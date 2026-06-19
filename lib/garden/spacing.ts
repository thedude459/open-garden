import type { MeasurementUnit } from "./enums";

const CM_PER_FOOT = 30.48;
const CM_PER_METER = 100;

export function cmToGardenUnits(cm: number, unit: MeasurementUnit): number {
  if (unit === "feet") {
    return cm / CM_PER_FOOT;
  }
  return cm / CM_PER_METER;
}

/** Spacing radius in garden units (half of plant spacing). */
export function spacingRadiusFromCm(spacingCm: number | null | undefined, unit: MeasurementUnit): number | null {
  if (spacingCm == null || spacingCm <= 0) {
    return null;
  }
  return cmToGardenUnits(spacingCm, unit) / 2;
}

export interface SpacingSource {
  spacing_cm?: { row?: number; plant?: number } | null;
}

export function resolvePlantSpacingCm(source: SpacingSource): number | null {
  const plantSpacing = source.spacing_cm?.plant;
  if (plantSpacing != null && plantSpacing > 0) {
    return plantSpacing;
  }
  const rowSpacing = source.spacing_cm?.row;
  if (rowSpacing != null && rowSpacing > 0) {
    return rowSpacing;
  }
  return null;
}

export function resolvePlantSpacingRadius(
  source: SpacingSource,
  unit: MeasurementUnit,
): number | null {
  return spacingRadiusFromCm(resolvePlantSpacingCm(source), unit);
}

export {
  resolvePlantSpacing,
  resolveIncompatiblePlantIds,
  type ResolvedPlantSpacing,
} from "./plant-context";
