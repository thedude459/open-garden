export type AreaKind = 'vegetable' | 'orchard' | 'greenhouse';
export type BedSite = 'raised' | 'in_ground';
export type BedStation = 'tree' | 'berry';

export const MULCHES = ['none', 'wood_chips', 'straw', 'leaves', 'compost', 'paper', 'plastic'] as const;
export type Mulch = (typeof MULCHES)[number];

export const MULCH_LABELS: Record<Mulch, string> = {
  none: 'No mulch',
  wood_chips: 'Wood chips',
  straw: 'Straw',
  leaves: 'Leaves',
  compost: 'Compost',
  paper: 'Paper',
  plastic: 'Plastic',
};

const UNDERPLANTING = new Set(['vegetable', 'herb', 'flower', 'fruit']);

export function mulchOrNone(value: string | null | undefined): Mulch {
  return (MULCHES as readonly string[]).includes(value ?? '') ? (value as Mulch) : 'none';
}

/** A picker may offer this plant for the bed. Occupancy is checked on save. */
export function allowsPlant(station: BedStation | null | undefined, plantType: string): boolean {
  if (station === 'tree') return plantType !== 'shrub';
  if (station === 'berry') return plantType !== 'tree';
  return plantType !== 'tree' && plantType !== 'shrub';
}

export function lifeForPlant(
  plantType: string,
  station: BedStation | null,
  requested?: string | null,
): 'annual' | 'perennial' | 'tree' {
  if (requested === 'annual' || requested === 'perennial' || requested === 'tree') return requested;
  if (plantType === 'tree') return 'tree';
  if (plantType === 'shrub' && station === 'berry') return 'perennial';
  return 'annual';
}

/** Moving a tray start onto a bed clears the tray. */
export function plantOutPatch(bedId: string): { bedId: string; trayId: null } {
  return { bedId, trayId: null };
}

export function placementRefusal(
  areaKind: AreaKind,
  station: BedStation | null,
  plantType: string,
  existing: { plantId: string; plantType: string }[],
  plantId: string,
): string | null {
  if (areaKind === 'vegetable' || areaKind === 'greenhouse') {
    if (plantType === 'tree' || plantType === 'shrub') {
      return 'Trees and shrubs belong in an orchard bed';
    }
    return null;
  }
  if (!station) return 'Choose a tree bed or a berry bed';
  if (station === 'tree') {
    if (plantType === 'shrub') return 'A shrub belongs in a berry bed';
    if (plantType === 'tree' && existing.some((row) => row.plantType === 'tree')) {
      return 'A tree bed holds one tree';
    }
    if (plantType === 'tree' || UNDERPLANTING.has(plantType)) return null;
    return 'Trees and shrubs belong in an orchard bed';
  }
  if (plantType === 'tree') return 'A tree needs its own bed';
  if (plantType === 'shrub') {
    const other = existing.find((row) => row.plantType === 'shrub' && row.plantId !== plantId);
    if (other) return 'A berry bed holds one kind of shrub';
    return null;
  }
  if (UNDERPLANTING.has(plantType)) return null;
  return 'A berry bed holds one kind of shrub';
}
