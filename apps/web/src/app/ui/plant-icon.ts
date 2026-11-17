import { Component, computed, input } from '@angular/core';
import { plantIconFile } from './crop-icons';

export { plantIconFile } from './crop-icons';

/** A plant's icon; decorative, so the name beside it is what is read. */
@Component({
  selector: 'og-plant-icon',
  standalone: true,
  host: { class: 'plant-icon', '[attr.data-icon]': 'file()' },
  template: `<img [src]="'/assets/crops/' + file() + '.svg'" alt="" width="40" height="40" />`,
})
export class PlantIcon {
  readonly plantType = input.required<string>();
  readonly cropId = input<string | null | undefined>(null);
  readonly file = computed(() => plantIconFile(this.plantType(), this.cropId()));
}
