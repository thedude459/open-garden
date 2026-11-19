import {
  computed,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  feetFromTreeSpacing,
  gramsFromInput,
  lengthUnit,
  treeSpacingInput,
  weightUnit,
} from '@open-garden/garden-layout';
import { formatDay } from '@open-garden/web-ui';
import { localIso } from '../today/today-groups';
import { harvestAmount } from './harvest-amount';
import { plantName, type PlantingPatchDto, type Units } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import type { ClientBed, ClientPlanting } from './plantings-offline.queue';

type Life = NonNullable<ClientPlanting['life']>;

/**
 * Edits one planting: dates, bed, note, photo, and its life. Emits the
 * change; the page saves it, so a late list response cannot undo a save.
 */
@Component({
  selector: 'og-planting-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    @let p = planting();
    <div class="planting-editor">
      <label>
        Planned for
        <input #plannedInput type="date" [attr.name]="'planned-' + p.id" />
      </label>
      <label>
        Planted
        <input #plantedInput type="date" [attr.name]="'planted-' + p.id" />
      </label>
      <label>
        Harvest
        <input #harvestInput type="date" [attr.name]="'harvested-' + p.id" />
      </label>
      <label>
        Bed
        <select #bedSelect [attr.name]="'bed-' + p.id">
          <option value="" [selected]="!p.bedId">Unassigned</option>
          @for (b of beds(); track b.id) {
            <option [value]="b.id" [selected]="p.bedId === b.id">{{ b.name }}</option>
          }
        </select>
      </label>
      <label>
        Note
        <textarea
          rows="2"
          [attr.name]="'note-' + p.id"
          [ngModel]="note() ?? p.note ?? ''"
          (ngModelChange)="note.set($event)"
        ></textarea>
      </label>
      <label>
        Photo
        <input type="file" accept="image/*" (change)="onPhoto($event)" />
      </label>
      @if (photo() || p.photo) {
        <img [src]="photo() || p.photo" alt="" width="96" />
      }
      <label>
        Life
        <select
          [attr.name]="'life-' + p.id"
          [ngModel]="life()"
          (ngModelChange)="lifeDraft.set($event)"
        >
          <option value="annual">Annual</option>
          <option value="perennial">Perennial</option>
          <option value="tree">Tree</option>
        </select>
      </label>
      @if (life() === 'tree') {
        <input
          [attr.name]="'rootstock-' + p.id"
          placeholder="Rootstock"
          [ngModel]="rootstock() ?? p.rootstock ?? ''"
          (ngModelChange)="rootstock.set($event)"
        />
        <input
          type="number"
          min="0"
          [attr.name]="'years-' + p.id"
          placeholder="Years to fruit"
          [ngModel]="years() ?? p.yearsToFruit"
          (ngModelChange)="years.set($event)"
        />
        <input
          type="number"
          min="1"
          [attr.name]="'feet-' + p.id"
          [placeholder]="'Spacing (' + lengthUnit(units()) + ')'"
          [ngModel]="spacing()?.value ?? treeSpacing(p.spacingFeet)"
          (ngModelChange)="spacing.set({ value: $event, units: units() })"
        />
      }
      <div class="filters">
        <button
          type="button"
          class="btn btn-primary"
          [attr.aria-busy]="saving() || null"
          [disabled]="saving()"
          (click)="emitSave(bedSelect.value)"
        >
          Save planting
        </button>
        @if (!p.plantedOn) {
          <!-- Planned until it is in the ground (ADR 0040); care starts from this day. -->
          <button
            type="button"
            class="btn btn-secondary"
            [attr.aria-label]="'Mark ' + plantName(p) + ' planted today'"
            [disabled]="saving()"
            (click)="markPlanted(bedSelect.value)"
          >
            Mark planted
          </button>
        }
        <button type="button" class="btn btn-secondary" (click)="sowAgain.emit()">Sow again</button>
        @if ((p.plantedOn || p.plannedOn) && life() === 'annual') {
          <button
            type="button"
            class="btn btn-secondary"
            [attr.aria-expanded]="repeating()"
            (click)="toggleRepeat()"
          >
            Repeat sowing
          </button>
        }
        @if (!confirmRemove()) {
          <button
            type="button"
            class="btn btn-secondary"
            [attr.aria-label]="'Remove ' + plantName(p)"
            (click)="confirmRemove.set(true)"
          >
            Remove
          </button>
        }
      </div>
      @if (repeating() && (p.plantedOn || p.plannedOn)) {
        <form class="filters repeat-form" (ngSubmit)="emitRepeat()">
          <label>
            Every
            <input
              type="number"
              name="everyWeeks"
              min="1"
              max="12"
              [(ngModel)]="everyWeeks"
              required
            />
            weeks
          </label>
          <label>
            until
            <input
              type="date"
              name="repeatUntil"
              [min]="p.plantedOn || p.plannedOn"
              [ngModel]="until()"
              (ngModelChange)="untilDraft.set($event)"
              required
            />
          </label>
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-busy]="repeatBusy() || null"
            [disabled]="repeatBusy()"
          >
            Add sowings
          </button>
        </form>
        <p class="muted">
          @if (suggestedUntil(); as last) {
            The last sowing that ripens before frost here is {{ last }}.
          }
          Dates outside this crop's sowing windows here, such as midsummer for a cool-season crop,
          are left out. Each sowing is added without a bed, and Today says when to sow it.
        </p>
      }
      <section class="harvests" aria-label="Harvests">
        <h4>Harvests</h4>
        @if (p.harvests?.length) {
          <ul class="card-list">
            @for (h of p.harvests; track h.harvestedOn) {
              <li class="row">
                <span>{{ formatDay(h.harvestedOn) }}: {{ harvestAmount(h, units()) }}</span>
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-label]="'Delete harvest of ' + formatDay(h.harvestedOn)"
                  (click)="deleteHarvest.emit(h.harvestedOn)"
                >
                  Delete
                </button>
              </li>
            }
          </ul>
          <p class="muted">Total: {{ harvestAmount(harvestTotal(), units()) }}</p>
        }
        <form class="filters" (ngSubmit)="emitHarvest()">
          <label>
            Picked on
            <input type="date" name="harvestOn" [(ngModel)]="harvestOn" required />
          </label>
          <label>
            Weight ({{ weightUnit(units()) }})
            <input
              type="number"
              name="harvestWeight"
              min="0"
              step="0.1"
              [(ngModel)]="harvestWeight"
            />
          </label>
          <label>
            Count
            <input type="number" name="harvestCount" min="0" step="1" [(ngModel)]="harvestCount" />
          </label>
          <button
            type="submit"
            class="btn btn-secondary"
            [attr.aria-busy]="harvestBusy() || null"
            [disabled]="harvestBusy()"
          >
            Log harvest
          </button>
        </form>
      </section>
      @if (confirmRemove()) {
        <p>Permanently remove this planting? This cannot be undone.</p>
        <div class="filters">
          <button type="button" class="btn btn-destructive" (click)="remove.emit()">
            Confirm remove
          </button>
          <button type="button" class="btn btn-secondary" (click)="confirmRemove.set(false)">
            Cancel
          </button>
        </div>
      }
    </div>
  `,
})
export class PlantingEditor {
  readonly plantName = plantName;
  readonly lengthUnit = lengthUnit;
  readonly units = inject(AuthApiService).units;

  planting = input.required<ClientPlanting>();
  beds = input<ClientBed[]>([]);
  saving = input(false);
  save = output<PlantingPatchDto>();
  sowAgain = output<void>();
  /** A day's harvest to record (ADR 0038); a weight in grams, a count, or neither. */
  logHarvest = output<{ harvestedOn: string; grams: number | null; count: number | null }>();
  deleteHarvest = output<string>();
  harvestBusy = input(false);
  readonly formatDay = formatDay;
  readonly harvestAmount = harvestAmount;
  readonly weightUnit = weightUnit;
  harvestOn = localIso();
  harvestWeight: number | string | null = null;
  harvestCount: number | string | null = null;
  /** Succession planting: the same crop every `everyWeeks` weeks until `until`. */
  repeat = output<{ everyWeeks: number; until: string }>();
  repeatBusy = input(false);
  /** The last sowing that ripens before frost, offered as the series' end. */
  suggestedUntil = input<string | null>(null);
  repeatOpened = output<void>();
  readonly repeating = signal(false);
  everyWeeks = 2;
  readonly untilDraft = signal('');
  readonly until = computed(() => this.untilDraft() || this.suggestedUntil() || '');
  remove = output<void>();
  failed = output<string>();

  /** Values typed but not yet saved; null means "as saved". */
  note = signal<string | null>(null);
  photo = signal<string | null>(null);
  lifeDraft = signal<Life | null>(null);
  rootstock = signal<string | null>(null);
  years = signal<number | null>(null);
  /** Tree spacing as typed, with the units it was typed in. */
  spacing = signal<{ value: number | null; units: Units } | null>(null);
  confirmRemove = signal(false);

  private readonly plannedInput = viewChild.required<ElementRef<HTMLInputElement>>('plannedInput');
  private readonly plantedInput = viewChild.required<ElementRef<HTMLInputElement>>('plantedInput');
  private readonly harvestInput = viewChild.required<ElementRef<HTMLInputElement>>('harvestInput');

  /** The dates last put in the inputs or sent to save; undefined before the first render. */
  private shown: { planned?: string | null; planted?: string | null; harvested?: string | null } =
    {};

  constructor() {
    // Date inputs are not bound. A reload after a rejected save must put the
    // saved date back, but a save that succeeds must not overwrite a date
    // typed while it was in flight, so only a date that changed is written.
    afterRenderEffect(() => {
      const p = this.planting();
      const planned = p.plannedOn ?? null;
      if (planned !== this.shown.planned) {
        syncDate(this.plannedInput().nativeElement, planned);
        this.shown.planned = planned;
      }
      if (p.plantedOn !== this.shown.planted) {
        syncDate(this.plantedInput().nativeElement, p.plantedOn);
        this.shown.planted = p.plantedOn;
      }
      if (p.harvestedOn !== this.shown.harvested) {
        syncDate(this.harvestInput().nativeElement, p.harvestedOn);
        this.shown.harvested = p.harvestedOn;
      }
    });
  }

  life(): Life {
    return this.lifeDraft() ?? this.planting().life ?? 'annual';
  }

  treeSpacing(feet: number | null | undefined): number | null {
    return feet == null ? null : treeSpacingInput(feet, this.units());
  }

  onPhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 280_000) {
      this.failed.emit('Photo must be under 280 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.photo.set(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  }

  /** Everything picked from this planting, added up. */
  harvestTotal() {
    const all = this.planting().harvests ?? [];
    return {
      grams: all.reduce((sum, h) => sum + (h.grams ?? 0), 0),
      count: all.reduce((sum, h) => sum + (h.count ?? 0), 0),
    };
  }

  emitHarvest() {
    const grams = gramsFromInput(this.harvestWeight, this.units());
    const raw =
      this.harvestCount === null || this.harvestCount === '' ? null : Number(this.harvestCount);
    const count = raw === null || !Number.isFinite(raw) ? null : Math.round(raw);
    if (!this.harvestOn || (count !== null && count < 0)) {
      this.failed.emit('Give the harvest a date, and a weight or count of 0 or more');
      return;
    }
    this.logHarvest.emit({ harvestedOn: this.harvestOn, grams, count });
    this.harvestWeight = null;
    this.harvestCount = null;
  }

  toggleRepeat() {
    this.repeating.update((open) => !open);
    if (this.repeating()) this.repeatOpened.emit();
  }

  emitRepeat() {
    const everyWeeks = Math.round(Number(this.everyWeeks));
    const until = this.until();
    if (!until || !(everyWeeks >= 1 && everyWeeks <= 12)) {
      this.failed.emit('Repeat every 1 to 12 weeks, until a date');
      return;
    }
    this.repeat.emit({ everyWeeks, until });
  }

  /** Sown or planted out today: the date goes in Planted, and the planting saves. */
  markPlanted(bedId: string) {
    this.plantedInput().nativeElement.value = localIso();
    this.emitSave(bedId);
  }

  emitSave(bedId: string) {
    const p = this.planting();
    const life = this.life();
    const spacing = this.spacing();
    const plannedOn = this.plannedInput().nativeElement.value || null;
    const plantedOn = this.plantedInput().nativeElement.value || null;
    const harvestedOn = this.harvestInput().nativeElement.value || null;
    this.shown = { planned: plannedOn, planted: plantedOn, harvested: harvestedOn };
    this.save.emit({
      plannedOn,
      plantedOn,
      harvestedOn,
      bedId: bedId || null,
      note: this.note() ?? p.note ?? null,
      photo: this.photo() ?? p.photo ?? null,
      life,
      rootstock: this.rootstock() ?? p.rootstock ?? null,
      yearsToFruit: numberOrNull(this.years() ?? p.yearsToFruit),
      spacingFeet: spacing ? typedFeet(spacing) : (p.spacingFeet ?? null),
      plantedYear: life === 'tree' ? (p.plantedYear ?? new Date().getFullYear()) : p.plantedYear,
    });
  }
}

function syncDate(input: HTMLInputElement, saved: string | null) {
  if (document.activeElement === input) return;
  // A late reload must not wipe a date typed before the model has it.
  if (saved || !input.value) input.value = saved ?? '';
}

function typedFeet(draft: { value: number | null; units: Units }): number | null {
  if (draft.value == null || String(draft.value) === '') return null;
  return feetFromTreeSpacing(draft.value, draft.units) || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
