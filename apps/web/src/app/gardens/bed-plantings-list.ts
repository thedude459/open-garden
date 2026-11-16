import { Component, input, output, signal } from '@angular/core';
import { plantName, type LayoutPlantingDto } from '@open-garden/shared-types';

/** The plants in one bed, each removable after a confirm. */
@Component({
  selector: 'og-bed-plantings-list',
  standalone: true,
  template: `
    @if (plantings().length) {
      <h3>In this bed</h3>
      <ul class="card-list">
        @for (p of plantings(); track p.id) {
          <li class="row">
            <span>{{ label(p) }}</span>
            @if (canEdit()) {
              @if (confirmId() !== p.id) {
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-label]="'Remove from bed ' + plantName(p)"
                  (click)="confirmId.set(p.id)"
                >
                  Remove
                </button>
              } @else {
                <span class="member-actions">
                  <button
                    type="button"
                    class="btn btn-primary"
                    [attr.aria-label]="'Confirm remove ' + plantName(p)"
                    (click)="confirm(p)"
                  >
                    Confirm
                  </button>
                  <button type="button" class="btn btn-secondary" (click)="confirmId.set(null)">
                    Cancel
                  </button>
                </span>
              }
            }
          </li>
        }
      </ul>
    }
  `,
})
export class BedPlantingsList {
  readonly plantName = plantName;
  plantings = input<LayoutPlantingDto[]>([]);
  canEdit = input(false);
  remove = output<LayoutPlantingDto>();
  confirmId = signal<string | null>(null);

  label(p: LayoutPlantingDto) {
    return p.status === 'active' ? plantName(p) : `${plantName(p)} (removed from catalog)`;
  }

  confirm(p: LayoutPlantingDto) {
    this.confirmId.set(null);
    this.remove.emit(p);
  }
}
