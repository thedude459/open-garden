export type PlantingLife = 'annual' | 'perennial' | 'tree';

export function plantingIsCurrent(
  life: PlantingLife,
  seasonYear: number,
  openYear: number | null,
): boolean {
  if (life !== 'annual') return true;
  if (openYear == null) return true;
  return seasonYear === openYear;
}

export function nextOpenYear(openYear: number): { closedYear: number; openYear: number } {
  return { closedYear: openYear, openYear: openYear + 1 };
}

export function survivesSeasonClose(life: PlantingLife): boolean {
  return life !== 'annual';
}

export function plantAgainRows<T extends { plantId: string; bedId: string | null; life: PlantingLife }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (row.life !== 'annual' || !row.bedId) continue;
    const key = `${row.bedId}:${row.plantId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
