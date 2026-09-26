export type PlantingMark = {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
};

export type PlantingMarkLabel = {
  id: string;
  name: string;
  x: number;
  y: number;
};

const CHAR_W = 3.1;
const LABEL_H = 7;

/** Prefix of the common name that fits in a mark of radius `radiusInches`. */
export function shortenPlantingMarkName(commonName: string, radiusInches: number): string {
  if (!commonName) return '';
  const maxChars = Math.floor((2 * radiusInches) / CHAR_W);
  if (maxChars <= 0) return commonName.slice(0, 1);
  return commonName.slice(0, maxChars);
}

/** Place names under each mark and nudge later labels down when boxes overlap. */
export function layoutPlantingLabels(marks: PlantingMark[]): PlantingMarkLabel[] {
  const placed: Array<PlantingMarkLabel & { w: number }> = [];
  const sorted = [...marks].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const mark of sorted) {
    const w = Math.max(16, mark.name.length * CHAR_W);
    let x = mark.x;
    let y = mark.y + mark.r + 6;
    let guard = 0;
    while (guard++ < 24 && placed.some((p) => boxesOverlap(x, y, w, p))) {
      y += LABEL_H + 1;
      x = mark.x + (guard % 2 === 0 ? 8 : -8);
    }
    placed.push({ id: mark.id, name: mark.name, x, y, w });
  }
  return placed.map(({ id, name, x, y }) => ({ id, name, x, y }));
}

function boxesOverlap(
  x: number,
  y: number,
  w: number,
  other: { x: number; y: number; w: number },
): boolean {
  const a1 = x - w / 2;
  const a2 = x + w / 2;
  const b1 = other.x - other.w / 2;
  const b2 = other.x + other.w / 2;
  return a1 < b2 && a2 > b1 && Math.abs(y - other.y) < LABEL_H;
}
