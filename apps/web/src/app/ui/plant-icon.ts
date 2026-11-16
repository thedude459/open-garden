import { Component, computed, input } from '@angular/core';

/**
 * Line drawings on a 24-unit grid, stroked in the tile's text colour. Made
 * for Open Garden and dedicated to the public domain (CC0-1.0).
 */
const ICONS = {
  vegetable: 'M12 21v-8M12 13C12 9 9 7 5 7c0 4 3 6 7 6zM12 11c0-4 3-6 7-6 0 4-3 6-7 6zM6 21h12',
  herb: 'M12 21V4M12 9C9 9 7 7 7 5c3 0 5 2 5 4zM12 9c3 0 5-2 5-4-3 0-5 2-5 4zM12 15c-3 0-5-2-5-4 3 0 5 2 5 4zM12 15c3 0 5-2 5-4-3 0-5 2-5 4z',
  flower:
    'M12 8m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M12 4m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M16 8m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M8 8m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M12 14.2V21M12 18c-2-2-4-2-5-1 1 2 3 2 5 1z',
  fruit:
    'M12 7c-2-1.5-6-1-7 3-1 4 2 10 5 10 1 0 1.5-.5 2-.5s1 .5 2 .5c3 0 6-6 5-10-1-4-5-4.5-7-3zM12 7c0-2 1-3 2.5-4M13 5c1.5-1.5 3.5-1.5 4.5-.5-1 1.5-3 1.5-4.5.5z',
  cane: 'M5 21C5 13 9 7 18 5M15 13m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.5 15.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M12.5 15.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15 18m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M9 11c-2 0-3.5-1-4-3 2 0 3.5 1 4 3z',
  shrub:
    'M5 17a3 3 0 0 1 0-6 4 4 0 0 1 6.5-4 4 4 0 0 1 7 2.5A3.5 3.5 0 0 1 19 17zM10 17v4M14 17v4M5 21h14',
  tree: 'M12 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 15v6M9 21h6M12 18l-2.5-2.5',
  nightshade:
    'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M12 6V3M12 6 9.5 4.5M12 6l2.5-1.5M12 6 8.5 7M12 6l3.5 1',
  cabbage:
    'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M8.5 8.5c2 1.5 3 4.5 3 11.5M15.5 8.5c-2 1.5-3 4.5-3 11.5M9 6.8c2-1 4-1 6 0M12 15c-1.5-1-3-1-4.5 0M12 15c1.5-1 3-1 4.5 0',
  gourd: 'M5 19c-3-3 0-9 5-12s9-3 10-1-2 8-7 11-6 4-8 2zM18 5.5 20 3.5M9 12c1.5-1.5 3.5-2.5 5-3',
  onion: 'M12 21c-4 0-7-3-7-6s3-5 7-8c4 3 7 5 7 8s-3 6-7 6zM12 7V2M12 7 9.5 3M12 7l2.5-4M12 21v-4',
  legume:
    'M3 15c5 3 13 1 18-8-5 5-13 7-18 8zM8.5 14m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M12.5 12.5m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M16 10m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0',
  carrot: 'M8.5 9h7L12 21zM12 9V3M12 9 9 4.5M12 9l3-4.5M10.5 13h2M11 16.5h1.5',
  corn: 'M12 4c-2.5 0-3.5 4-3.5 8s1 9 3.5 9 3.5-5 3.5-9-1-8-3.5-8zM8.5 12c-2 2-3 6-2 9M15.5 12c2 2 3 6 2 9M12 6v13M10 9h4M10 13h4M10 17h4',
} as const;

export type PlantIconName = keyof typeof ICONS;

/** Vegetable families with a drawing of their own, by the catalog's family name. */
const FAMILY_ICONS: Record<string, PlantIconName> = {
  'Nightshade family': 'nightshade',
  'Cabbage family': 'cabbage',
  'Gourd family': 'gourd',
  'Onion family': 'onion',
  'Legume family': 'legume',
  'Carrot family': 'carrot',
  'Grass family': 'corn',
};

/**
 * The drawing for a plant: its family's for a vegetable whose family has one
 * (a dill is an herb, not a carrot), otherwise its type's.
 */
export function plantIcon(plantType: string, family?: string | null): PlantIconName {
  const byFamily = plantType === 'vegetable' && family ? FAMILY_ICONS[family] : undefined;
  if (byFamily) return byFamily;
  return plantType in ICONS ? (plantType as PlantIconName) : 'vegetable';
}

/** A plant's drawn icon on its type's colour; decorative, so the name beside it is read. */
@Component({
  selector: 'og-plant-icon',
  standalone: true,
  host: {
    class: 'plant-stand-in',
    '[attr.data-plant-type]': 'plantType()',
    '[attr.data-icon]': 'name()',
    'aria-hidden': 'true',
  },
  template: `
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class PlantIcon {
  readonly plantType = input.required<string>();
  readonly family = input<string | null | undefined>(null);
  readonly name = computed(() => plantIcon(this.plantType(), this.family()));
  readonly path = computed(() => ICONS[this.name()]);
}
