import { Component, input, output } from '@angular/core';

/**
 * Which season a plan or planting list shows (ADR 0040): this one, or the
 * next, planned while this one grows.
 */
@Component({
  selector: 'og-season-picker',
  standalone: true,
  template: `
    <label class="season-picker">
      Season
      <select
        name="season"
        [value]="String(shown())"
        (change)="picked.emit(Number($any($event.target).value))"
      >
        <option [value]="String(current())" [selected]="shown() === current()">
          {{ current() }} (now)
        </option>
        <option [value]="String(current() + 1)" [selected]="shown() === current() + 1">
          {{ current() + 1 }} (planning)
        </option>
      </select>
    </label>
  `,
})
export class SeasonPicker {
  readonly String = String;
  readonly Number = Number;
  /** The property's current season. */
  current = input.required<number>();
  /** The season shown. */
  shown = input.required<number>();
  picked = output<number>();
}
