import { Component, input, output, signal } from '@angular/core';
import { plantName, type LayoutPlantingDto } from '@open-garden/shared-types';
import { formatDay } from '@open-garden/web-ui';

/**
 * The plants in one bed, each removable after a confirm. A planned one (not
 * in the ground yet, ADR 0040) says so and can be marked planted.
 */
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
              @if (!p.plantedOn && confirmId() !== p.id) {
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-label]="'Mark ' + plantName(p) + ' planted today'"
                  (click)="markPlanted.emit(p)"
                >
                  Mark planted
                </button>
              }
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
  markPlanted = output<LayoutPlantingDto>();
  confirmId = signal<string | null>(null);

  label(p: LayoutPlantingDto) {
    const name = p.status === 'active' ? plantName(p) : `${plantName(p)} (removed from catalog)`;
    if (p.plantedOn) return name;
    return p.plannedOn ? `${name} · planned for ${formatDay(p.plannedOn)}` : `${name} · planned`;
  }

  confirm(p: LayoutPlantingDto) {
    this.confirmId.set(null);
    this.remove.emit(p);
  }
}
