import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'og-garden-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="garden-nav" aria-label="Garden">
      <a
        [routerLink]="['/gardens', gardenId(), 'layout']"
        routerLinkActive="active"
        aria-label="Garden Overview"
        >Overview</a
      >
      <a [routerLink]="['/gardens', gardenId(), 'plantings']" routerLinkActive="active">Plantings</a>
      <a [routerLink]="['/gardens', gardenId(), 'calendar']" routerLinkActive="active">Calendar</a>
      <a [routerLink]="['/gardens', gardenId(), 'reminders']" routerLinkActive="active">Reminders</a>
      <a [routerLink]="['/gardens', gardenId(), 'transplants']" routerLinkActive="active">Transplants</a>
      <a [routerLink]="['/gardens', gardenId(), 'configure']" routerLinkActive="active">Configuration</a>
    </nav>
  `,
})
export class GardenNav {
  readonly gardenId = input.required<string>();
}
