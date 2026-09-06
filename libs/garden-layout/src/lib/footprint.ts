/** Half-size of the planting mark in inches. Known spacing s → ceil(s / 2). Null → 6 (visual only). */
export function plantingFootprintRadius(spacingInches: number | null): number {
  if (spacingInches === null) return 6;
  return Math.ceil(spacingInches / 2);
}
