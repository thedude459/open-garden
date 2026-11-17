import type { Units } from '@open-garden/shared-types';

/**
 * How far below full the soil is when watering is due by the water balance
 * (ADR 0035), in the member's units: "Soil about 1.0 in short of water".
 */
export function waterNote(deficitMm: number | null | undefined, units: Units): string | null {
  if (deficitMm == null) return null;
  const amount =
    units === 'metric' ? `${Math.round(deficitMm)} mm` : `${(deficitMm / 25.4).toFixed(1)} in`;
  return `Soil about ${amount} short of water`;
}
