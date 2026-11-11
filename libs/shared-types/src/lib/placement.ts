import type { PlantType } from './plant';

export const AREA_KINDS = ['vegetable', 'orchard', 'bramble', 'greenhouse'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
export type BedSite = 'raised' | 'in_ground';
/** Which area a new bed goes in: `tree` an orchard, `berry` a bramble patch. */
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
 * any habit is an herb; a tree, shrub, or cane is that whatever its use), so
 * the rule is a list. A new area type is one entry here.
 */
export const AREA_TYPES: Record<AreaKind, { name: string; accepts: readonly PlantType[] }> = {
  vegetable: { name: 'a vegetable garden', accepts: HERBACEOUS },
  // One tree per bed, with herbaceous underplanting.
  orchard: { name: 'an orchard', accepts: ['tree', ...HERBACEOUS] },
  // Cane fruit, and fruit bushes until they have an area of their own.
  bramble: { name: 'a bramble patch', accepts: ['cane', 'shrub'] },
  // Seedlings in trays.
  greenhouse: { name: 'a greenhouse', accepts: HERBACEOUS },
};

/** The area a bed belongs to, from how it was created. */
export function areaKindFor(station: BedStation | null | undefined): AreaKind {
  if (station === 'tree') return 'orchard';
  if (station === 'berry') return 'bramble';
  return 'vegetable';
}

/** A picker may offer this plant for an area. Occupancy is checked on save. */
export function allowsPlant(area: AreaKind, plantType: string): boolean {
  return (AREA_TYPES[area].accepts as readonly string[]).includes(plantType);
}

/** Where a plant goes when this area will not take it. */
export function homeFor(plantType: string): AreaKind {
  if (plantType === 'tree') return 'orchard';
  if (plantType === 'cane' || plantType === 'shrub') return 'bramble';
  return 'vegetable';
}

export function lifeForPlant(
  plantType: string,
  requested?: string | null,
): 'annual' | 'perennial' | 'tree' {
  if (requested === 'annual' || requested === 'perennial' || requested === 'tree') return requested;
  if (plantType === 'tree') return 'tree';
  if (plantType === 'cane' || plantType === 'shrub') return 'perennial';
  return 'annual';
}

/** Moving a tray start onto a bed clears the tray. */
export function plantOutPatch(bedId: string): { bedId: string; trayId: null } {
  return { bedId, trayId: null };
}

export function placementRefusal(
  area: AreaKind,
  plantType: string,
  existing: { plantType: string }[],
): string | null {
  if (!allowsPlant(area, plantType)) {
    const home = AREA_TYPES[homeFor(plantType)].name;
    return `${PLANT_TYPE_NAMES[plantType as PlantType] ?? 'This plant'} belongs in ${home}`;
  }
  if (
    area === 'orchard' &&
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
};
