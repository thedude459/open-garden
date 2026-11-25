import { Component, computed, input, linkedSignal, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PropertyAreaDto, SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import { formatDay } from '@open-garden/web-ui';
import { SoilTestPanel } from './soil-test-panel';

/** A bed of the area as the panel lists it. */
export interface AreaBed {
  id: string;
  name: string;
  /** What grows in it, by name, once each. */
  plants: string[];
  /** The bed's own test, which wins over the area's. */
  soilTest: SoilTestDto | null;
}

/**
 * One area of the property on the plan: what it holds, its beds and what
 * grows in them, and its soil test. Editors also rename it and delete it
 * once it is empty, so no bed or tray is lost; viewers see it read-only.
 */
@Component({
  selector: 'og-area-panel',
  standalone: true,
  imports: [FormsModule, SoilTestPanel],
  template: `
    @let a = area();
    <section class="area-panel" [attr.aria-label]="'Area ' + a.name">
      <h4>
        <span [attr.data-area-kind]="a.kind">{{ a.name }}</span>
      </h4>
      <p class="muted">{{ holds() }}</p>
      @if (beds().length) {
        <ul class="area-beds">
          @for (bed of beds(); track bed.id) {
            <li>
              <strong>{{ bed.name }}</strong>: {{ bed.plants.join(', ') || 'nothing planted' }}
              @if (bed.soilTest; as t) {
                <span class="muted"> · {{ ownTest(t) }}</span>
              }
            </li>
          }
        </ul>
      }
      @if (canEdit()) {
        <form class="filters" (ngSubmit)="submitName()">
          <label>
            Name
            <input
              [name]="'areaName-' + a.id"
              [attr.name]="'areaName-' + a.id"
              maxlength="120"
              [ngModel]="nameDraft()"
              (ngModelChange)="nameDraft.set($event)"
            />
          </label>
          <button type="submit" class="btn btn-secondary" [attr.aria-label]="'Rename ' + a.name">
            Rename
          </button>
        </form>
        @if (empty()) {
          @if (confirming()) {
            <p>Delete {{ a.name }}? It holds nothing.</p>
            <div class="filters">
              <button
                type="button"
                class="btn btn-destructive"
                [attr.aria-label]="'Confirm delete area ' + a.name"
                (click)="remove.emit()"
              >
                Confirm delete
              </button>
              <button type="button" class="btn btn-secondary" (click)="confirming.set(false)">
                Cancel
              </button>
            </div>
          } @else {
            <button
              type="button"
              class="btn btn-secondary"
              [attr.aria-label]="'Delete area ' + a.name"
              (click)="confirming.set(true)"
            >
              Delete area
            </button>
          }
        }
      }
      @if (a.kind !== 'greenhouse') {
        <og-soil-test-panel
          [ownerId]="a.id"
          [name]="a.name"
          [test]="soilTest()"
          emptyText="No test yet. One lab test of the whole area covers its beds; a bed whose soil differs, such as a raised bed, can have its own."
          [canEdit]="canEdit()"
          [save]="saveTest()"
          [remove]="removeTest()"
        />
      }
    </section>
  `,
})
export class AreaPanel {
  area = input.required<PropertyAreaDto>();
  /** Editors rename, delete, and record soil tests; viewers read. */
  canEdit = input(false);
  beds = input<AreaBed[]>([]);
  bedCount = input(0);
  trayCount = input(0);
  soilTest = input<SoilTestDto | null>(null);
  saveTest = input.required<(test: SoilTestCreateDto) => Promise<boolean>>();
  removeTest = input.required<(test: SoilTestDto) => Promise<boolean>>();
  rename = output<string>();
  remove = output<void>();

  private readonly areaId = computed(() => this.area().id);
  /** The name as typed; starts over for another area, or once a rename is saved. */
  nameDraft = linkedSignal({
    source: () => this.area().name,
    computation: () => untracked(this.area).name,
  });
  confirming = linkedSignal({ source: this.areaId, computation: () => false });
  empty = computed(() => this.bedCount() === 0 && this.trayCount() === 0);

  holds = computed(() => {
    if (this.area().kind === 'greenhouse') return count(this.trayCount(), 'tray');
    return count(this.bedCount(), 'bed');
  });

  ownTest(t: SoilTestDto): string {
    const ph = t.ph != null ? `pH ${t.ph}, ` : '';
    return `its own soil test: ${ph}${formatDay(t.testedOn)}`;
  }

  submitName() {
    const name = this.nameDraft().trim();
    if (name && name !== this.area().name) this.rename.emit(name);
  }
}

function count(n: number, noun: string): string {
  if (n === 0) return `No ${noun}s yet`;
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}
