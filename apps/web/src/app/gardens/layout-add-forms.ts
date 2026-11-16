import { Component, effect, inject, input, output, untracked, type Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  convertLength,
  inchesFromInput,
  lengthInput,
  lengthStep,
  lengthUnit,
} from '@open-garden/garden-layout';
import {
  MULCH_LABELS,
  MULCHES,
  type BedSite,
  type Mulch,
  type Units,
} from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';

/** A new bed or walkway's name and size, in inches. */
export interface NewPlot {
  name: string;
  lengthInches: number;
  widthInches: number;
}

export interface NewBed extends NewPlot {
  site: BedSite;
  mulch: Mulch;
}

/**
 * Length and width as typed, in the member's units. Switching units
 * converts what is typed, so a half-filled form keeps its meaning.
 */
class TypedSize {
  length: number | null;
  width: number | null;
  private units: Units;

  constructor(current: Signal<Units>, lengthInches: number, widthInches: number) {
    this.units = current();
    this.length = lengthInput(lengthInches, this.units);
    this.width = lengthInput(widthInches, this.units);
    effect(() => {
      const next = current();
      untracked(() => {
        if (next === this.units) return;
        const convert = (value: number | null) =>
          value == null ? null : convertLength(value, this.units, next);
        this.length = convert(this.length);
        this.width = convert(this.width);
        this.units = next;
      });
    });
  }

  /** The typed name and size, or null when the name is blank or a side is under an inch. */
  plot(name: string): NewPlot | null {
    const plot = {
      name: name.trim(),
      lengthInches: inchesFromInput(this.length ?? 0, this.units),
      widthInches: inchesFromInput(this.width ?? 0, this.units),
    };
    return plot.name && plot.lengthInches >= 1 && plot.widthInches >= 1 ? plot : null;
  }
}

@Component({
  selector: 'og-layout-new-bed',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="inspector" aria-label="New bed" (ngSubmit)="submit()">
      <h3>New bed</h3>
      @if (note()) {
        <p class="muted">{{ note() }}</p>
      }
      <label>
        Name
        <input [(ngModel)]="name" name="bedName" placeholder="Bed name" />
      </label>
      <label>
        Length ({{ lengthUnit(units()) }})
        <input
          type="number"
          [min]="lengthStep(units())"
          [step]="lengthStep(units())"
          [(ngModel)]="size.length"
          name="newLength"
        />
      </label>
      <label>
        Width ({{ lengthUnit(units()) }})
        <input
          type="number"
          [min]="lengthStep(units())"
          [step]="lengthStep(units())"
          [(ngModel)]="size.width"
          name="newWidth"
        />
      </label>
      <label>
        Ground
        <select name="bedSite" [(ngModel)]="site">
          <option value="in_ground">In-ground</option>
          <option value="raised">Raised</option>
        </select>
      </label>
      <label>
        Mulch
        <select name="bedMulch" [(ngModel)]="mulch">
          @for (m of mulches; track m) {
            <option [value]="m">{{ mulchLabels[m] }}</option>
          }
        </select>
      </label>
      <div class="filters">
        <button type="submit" class="btn btn-primary">Create bed</button>
        @if (canCancel()) {
          <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Cancel</button>
        }
      </div>
    </form>
  `,
})
export class LayoutNewBedForm {
  readonly units = inject(AuthApiService).units;
  readonly lengthUnit = lengthUnit;
  readonly lengthStep = lengthStep;
  readonly mulches = MULCHES;
  readonly mulchLabels = MULCH_LABELS;

  /** Shown above the form, such as why the plan is empty. */
  note = input('');
  canCancel = input(true);
  create = output<NewBed>();
  cancelled = output<void>();

  name = '';
  size = new TypedSize(this.units, 96, 48);
  site: BedSite = 'in_ground';
  mulch: Mulch = 'none';

  submit() {
    const plot = this.size.plot(this.name);
    if (plot) this.create.emit({ ...plot, site: this.site, mulch: this.mulch });
  }
}

@Component({
  selector: 'og-layout-new-walkway',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="inspector" aria-label="New walkway" (ngSubmit)="submit()">
      <h3>New walkway</h3>
      <label>
        Name
        <input [(ngModel)]="name" name="areaName" placeholder="Area name" />
      </label>
      <label>
        Length ({{ lengthUnit(units()) }})
        <input
          type="number"
          [min]="lengthStep(units())"
          [step]="lengthStep(units())"
          [(ngModel)]="size.length"
          name="newAreaLength"
        />
      </label>
      <label>
        Width ({{ lengthUnit(units()) }})
        <input
          type="number"
          [min]="lengthStep(units())"
          [step]="lengthStep(units())"
          [(ngModel)]="size.width"
          name="newAreaWidth"
        />
      </label>
      <div class="filters">
        <button type="submit" class="btn btn-primary" aria-label="Create non-planting area">
          Create walkway
        </button>
        <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Cancel</button>
      </div>
    </form>
  `,
})
export class LayoutNewWalkwayForm {
  readonly units = inject(AuthApiService).units;
  readonly lengthUnit = lengthUnit;
  readonly lengthStep = lengthStep;

  create = output<NewPlot>();
  cancelled = output<void>();

  name = '';
  size = new TypedSize(this.units, 48, 48);

  submit() {
    const plot = this.size.plot(this.name);
    if (plot) this.create.emit(plot);
  }
}
