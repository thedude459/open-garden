import { Component, computed, input, linkedSignal, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PropertyAreaDto, SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import { SoilTestPanel } from './soil-test-panel';

/**
 * One area of the property on the plan: its name (rename), what it holds,
 * its soil test, and delete once it is empty, so no bed or tray is lost.
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
      @if (a.kind !== 'greenhouse') {
        <og-soil-test-panel
          [ownerId]="a.id"
          [name]="a.name"
          [test]="soilTest()"
          emptyText="No test yet. One lab test of the whole area covers its beds; a bed whose soil differs, such as a raised bed, can have its own."
          [canEdit]="true"
          [save]="saveTest()"
          [remove]="removeTest()"
        />
      }
    </section>
  `,
})
export class AreaPanel {
  area = input.required<PropertyAreaDto>();
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

  submitName() {
    const name = this.nameDraft().trim();
    if (name && name !== this.area().name) this.rename.emit(name);
  }
}

function count(n: number, noun: string): string {
  if (n === 0) return `No ${noun}s yet`;
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}
