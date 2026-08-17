export function pairRequiredSpacing(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.max(a, b);
}

export function fitClearance(spacingInches: number): number {
  return Math.ceil(spacingInches / 2);
}

export function centerDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function placementFits(
  xInches: number,
  yInches: number,
  lengthInches: number,
  widthInches: number,
  spacingInches: number | null,
): boolean {
  if (spacingInches === null) return true;
  if (lengthInches < spacingInches || widthInches < spacingInches) return false;
  const c = fitClearance(spacingInches);
  return xInches >= c && xInches <= lengthInches - c && yInches >= c && yInches <= widthInches - c;
}
