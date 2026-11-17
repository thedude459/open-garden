import type { PlantSummaryDto } from '@open-garden/shared-types';

/**
 * Crops a first-year household does well with, by dataset crop id, easiest
 * first. ponytail: a hand-picked list; with use data, rank by what households
 * here actually grow.
 */
export const STARTER_CROP_IDS = [
  'tomato',
  'lettuce',
  'bush-bean',
  'radish',
  'basil',
  'summer-squash',
  'pea',
  'carrot',
  'cucumber',
  'kale',
  'sweet-pepper',
  'spinach',
  'potato',
  'garlic',
  'onion',
  'strawberry',
];

/**
 * Starter crops for a property: each crop's own catalog entry (not a
 * variety) that grows in its zone, once each, those that can be sown this
 * week first.
 */
export function starterCrops(
  catalog: PlantSummaryDto[],
  zone: number | null,
  sowableIds: ReadonlySet<string>,
  limit = 12,
): PlantSummaryDto[] {
  const rank = new Map(STARTER_CROP_IDS.map((id, i) => [id, i]));
  const seen = new Set<string>();
  return (
    catalog
      .filter((p) => p.cultivar == null && p.cropId != null && rank.has(p.cropId))
      .filter((p) => zone == null || (p.zoneMin <= zone && zone <= p.zoneMax))
      // One entry per crop, should the catalog hold two for it.
      .filter((p) => !seen.has(p.cropId!) && seen.add(p.cropId!))
      .sort(
        (a, b) =>
          Number(sowableIds.has(b.id)) - Number(sowableIds.has(a.id)) ||
          rank.get(a.cropId!)! - rank.get(b.cropId!)!,
      )
      .slice(0, limit)
  );
}
