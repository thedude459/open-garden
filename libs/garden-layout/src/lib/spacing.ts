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

/** How many more of this spacing fit on a grid, given plants already in the bed. */
export function remainingGridCount(
  lengthInches: number,
  widthInches: number,
  spacingInches: number,
  occupied: { xInches: number; yInches: number; spacingInches: number | null }[],
): number {
  const clearance = fitClearance(spacingInches);
  if (lengthInches < spacingInches || widthInches < spacingInches) return 0;
  let count = 0;
  for (let y = clearance; y <= widthInches - clearance; y += spacingInches) {
    for (let x = clearance; x <= lengthInches - clearance; x += spacingInches) {
      const open = occupied.every((plant) => {
        const need = pairRequiredSpacing(spacingInches, plant.spacingInches);
        if (need === null) return true;
        return centerDistance(x, y, plant.xInches, plant.yInches) >= need;
      });
      if (open) count += 1;
    }
  }
  return count;
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
