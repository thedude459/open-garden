import type { PlantType } from './plant';

export const AREA_KINDS = ['vegetable', 'fruit', 'greenhouse'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
export type BedSite = 'raised' | 'in_ground';
/**
 * A bed's shape in a fruit garden: `tree` holds one tree (with underplanting),
 * `berry` is a row of canes, bushes, or vines. Vegetable beds have none.
 */
export type BedStation = 'tree' | 'berry';

export const MULCHES = [
  'none',
  'wood_chips',
  'straw',
  'leaves',
  'compost',
  'paper',
  'plastic',
] as const;
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

export function mulchOrNone(value: string | null | undefined): Mulch {
  return (MULCHES as readonly string[]).includes(value ?? '') ? (value as Mulch) : 'none';
}

const HERBACEOUS: readonly PlantType[] = ['vegetable', 'herb', 'flower', 'fruit'];

/**
 * What each area type takes. Plant types already put habit first (an herb of
 * any habit is an herb; a tree, shrub, cane, or woody vine is that whatever
 * its use), so the rule is a list. A new area type is one entry here.
 */
export const AREA_TYPES: Record<AreaKind, { name: string; accepts: readonly PlantType[] }> = {
  // Herbaceous plants, perennials such as asparagus and strawberries included.
  vegetable: { name: 'a vegetable garden', accepts: HERBACEOUS },
  // Woody fruit (one tree per tree bed; rows of canes, bushes, and vines),
  // with herbaceous underplanting.
  fruit: { name: 'a fruit garden', accepts: ['tree', 'cane', 'shrub', 'vine', ...HERBACEOUS] },
  // Seedlings in trays.
  greenhouse: { name: 'a greenhouse', accepts: HERBACEOUS },
};

const WOODY: readonly string[] = ['tree', 'cane', 'shrub', 'vine'];

/** The area a bed belongs to, from how it was created. */
export function areaKindFor(station: BedStation | null | undefined): AreaKind {
  return station ? 'fruit' : 'vegetable';
}

/**
 * A bed's station in an area of this kind: a fruit garden keeps the bed's own
 * (a tree bed when it has none), anything else has none.
 */
export function stationFor(kind: AreaKind, current?: BedStation | null): BedStation | null {
  return kind === 'fruit' ? (current ?? 'tree') : null;
}

/** A picker may offer this plant for an area. Occupancy is checked on save. */
export function allowsPlant(area: AreaKind, plantType: string): boolean {
  return (AREA_TYPES[area].accepts as readonly string[]).includes(plantType);
}

/** Where a plant goes when this area will not take it. */
export function homeFor(plantType: string): AreaKind {
  return WOODY.includes(plantType) ? 'fruit' : 'vegetable';
}

/**
 * A planting's life: what was asked for, else a tree, else perennial for
 * woody plants and herbaceous perennials (asparagus, rhubarb), else annual.
 */
export function lifeForPlant(
  plantType: string,
  requested?: string | null,
  perennial?: boolean | null,
): 'annual' | 'perennial' | 'tree' {
  if (requested === 'annual' || requested === 'perennial' || requested === 'tree') return requested;
  if (plantType === 'tree') return 'tree';
  if (WOODY.includes(plantType) || perennial) return 'perennial';
  return 'annual';
}

/** Moving a tray start onto a bed clears the tray. */
export function plantOutPatch(bedId: string): { bedId: string; trayId: null } {
  return { bedId, trayId: null };
}

/**
 * Why a plant may not go in a bed, or null. `station` is the bed's: a tree bed
 * holds one tree.
 */
export function placementRefusal(
  area: AreaKind,
  plantType: string,
  existing: { plantType: string }[],
  station?: BedStation | null,
): string | null {
  if (!allowsPlant(area, plantType)) {
    const home = AREA_TYPES[homeFor(plantType)].name;
    return `${PLANT_TYPE_NAMES[plantType as PlantType] ?? 'This plant'} belongs in ${home}`;
  }
  if (
    station === 'tree' &&
    plantType === 'tree' &&
    existing.some((row) => row.plantType === 'tree')
  ) {
    return 'A tree bed holds one tree';
  }
  return null;
}

const PLANT_TYPE_NAMES: Partial<Record<PlantType, string>> = {
  tree: 'A tree',
  shrub: 'A fruit bush',
  cane: 'Cane fruit',
  vine: 'A fruiting vine',
};
