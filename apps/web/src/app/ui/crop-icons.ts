/**
 * Crops with an icon in `assets/crops`, named by dataset crop id. The icons
 * are copied from open-garden-data's `icons/` (CC0; many from OpenFarm's
 * open-crop-icons), which keeps one per crop: copy new ones across with the
 * catalog.
 */
export const CROP_ICONS = new Set([
  'apple',
  'asparagus',
  'basil',
  'beet',
  'blackberry',
  'blueberry',
  'borage',
  'broccoli',
  'brussels-sprouts',
  'bush-bean',
  'cabbage',
  'calendula',
  'carrot',
  'cauliflower',
  'celery',
  'chives',
  'cilantro',
  'comfrey',
  'cucumber',
  'dill',
  'eggplant',
  'garlic',
  'hot-pepper',
  'kale',
  'leek',
  'lettuce',
  'marigold',
  'melon',
  'mint',
  'nasturtium',
  'okra',
  'onion',
  'oregano',
  'parsley',
  'parsnip',
  'pea',
  'peach',
  'pear',
  'pole-bean',
  'potato',
  'pumpkin',
  'radish',
  'raspberry',
  'rhubarb',
  'spinach',
  'strawberry',
  'summer-squash',
  'sweet-alyssum',
  'sweet-cherry',
  'sweet-corn',
  'sweet-pepper',
  'sweet-potato',
  'swiss-chard',
  'tansy',
  'thyme',
  'tomato',
  'watermelon',
  'winter-squash',
]);

/** The icon file for a plant: its crop's, else a generic flower or plant. */
export function plantIconFile(plantType: string, cropId?: string | null): string {
  if (cropId && CROP_ICONS.has(cropId)) return cropId;
  return plantType === 'flower' ? 'generic-flower' : 'generic-plant';
}
