import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'og-place-marker',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="place-marker" aria-label="You are here">
      @if (gardenId()) {
        <a [routerLink]="['/gardens', gardenId(), 'layout']" aria-label="Garden home">{{ gardenName() }}</a>
      } @else {
        <span>{{ gardenName() }}</span>
      }
      <span aria-hidden="true"> &gt; </span>
      <span>{{ current() }}</span>
    </nav>
  `,
})
export class PlaceMarker {
  readonly gardenId = input<string | null>(null);
  readonly gardenName = input.required<string>();
  readonly current = input.required<string>();
}
