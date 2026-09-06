import { Component, input, output } from '@angular/core';
import type { LayoutPlantingDto } from '@open-garden/shared-types';

@Component({
  standalone: true,
  selector: 'og-planting-tray',
  template: `
    <section class="unplaced-tray" aria-label="Planting tray">
      <h3>Planting tray</h3>
      @if (!plantings().length) {
        <p class="muted">No transplants waiting.</p>
      } @else {
        <ul class="card-list">
          @for (p of plantings(); track p.id) {
            <li>
              <button
                type="button"
                class="tray-item"
                [attr.data-planting-id]="p.id"
                [attr.aria-label]="label(p)"
                (pointerdown)="onPointerDown($event, p)"
              >
                {{ label(p) }}
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PlantingTray {
  readonly plantings = input<LayoutPlantingDto[]>([]);
  readonly canEdit = input(false);
  readonly online = input(true);
  readonly startDrag = output<{ plantingId: string; pointerId: number }>();
  readonly offlineRequired = output<void>();

  label(p: LayoutPlantingDto) {
    return p.status === 'active' ? p.commonName : `${p.commonName} (removed from catalog)`;
  }

  onPointerDown(ev: PointerEvent, planting: LayoutPlantingDto) {
    if (!this.canEdit()) return;
    if (!this.online()) {
      this.offlineRequired.emit();
      return;
    }
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.startDrag.emit({ plantingId: planting.id, pointerId: ev.pointerId });
  }
}
