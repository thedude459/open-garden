import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HALF_FOOT_INCHES,
  inchesFromInput,
  lengthInput,
  lengthStep,
  lengthUnit,
  snapHalfFoot,
} from '@open-garden/garden-layout';
import {
  MULCH_LABELS,
  MULCHES,
  type BedGeometryDto,
  type LayoutBedDto,
  type PropertyAreaDto,
} from '@open-garden/shared-types';
import type { SoilTestCreateDto, SoilTestDto, SoilTestOwner } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { SoilTestPanel } from './soil-test-panel';

export interface BedSettingsPatch {
  name?: string;
  sun?: string | null;
  site?: string;
  mulch?: string;
}

type GeometryField = 'originXInches' | 'originYInches' | 'lengthInches' | 'widthInches';

/**
 * The selected bed on Garden Overview: its name and settings (saved at once
 * for a bed the server has), its position and size (part of the layout
 * draft), rotate, and delete after a confirm.
 */
@Component({
  selector: 'og-layout-bed-inspector',
  standalone: true,
  imports: [FormsModule, SoilTestPanel],
  template: `
    @let b = bed();
    <section class="inspector" aria-label="Selected bed">
      <h3>{{ b.name }}</h3>
      @if (saved()) {
        <form class="filters" (ngSubmit)="settings.emit({ name: renameDraft() })">
          <label>
            Name
            <input
              name="selectedName"
              [ngModel]="renameDraft()"
              (ngModelChange)="renameDraft.set($event)"
            />
          </label>
          <button type="submit" class="btn btn-secondary" [attr.aria-label]="'Rename ' + b.name">
            Rename
          </button>
        </form>
        <label>
          Sun
          <select
            name="selectedSun"
            [ngModel]="b.sun ?? ''"
            (ngModelChange)="settings.emit({ sun: $event || null })"
          >
            <option value="">Not set</option>
            <option value="full">Full sun</option>
            <option value="part">Part sun</option>
            <option value="shade">Shade</option>
          </select>
        </label>
        <label>
          Ground
          <select
            name="selectedSite"
            [ngModel]="b.site ?? 'in_ground'"
            (ngModelChange)="settings.emit({ site: $event })"
          >
            <option value="in_ground">In-ground</option>
            <option value="raised">Raised</option>
          </select>
        </label>
        <label>
          Mulch
          <select
            name="selectedMulch"
            [ngModel]="b.mulch ?? 'none'"
            (ngModelChange)="settings.emit({ mulch: $event })"
          >
            @for (m of mulches; track m) {
              <option [value]="m">{{ mulchLabels[m] }}</option>
            }
          </select>
        </label>
        @if (areas().length > 1) {
          <label>
            Area
            <select name="selectedArea" [value]="b.areaId ?? ''" (change)="pickArea($event)">
              @for (a of areas(); track a.id) {
                <option [value]="a.id" [selected]="a.id === b.areaId">{{ a.name }}</option>
              }
            </select>
          </label>
        }
        <og-soil-test-panel
          [ownerId]="b.id"
          [name]="b.name"
          [test]="b.soilTest ?? null"
          [inherited]="areaSoilTest()"
          [canEdit]="true"
          [save]="saveTest"
          [remove]="deleteTest"
        />
      } @else {
        <p class="muted">Save the layout to set its name, sun, ground, and mulch.</p>
      }
      @if (b.geometry; as geo) {
        <form class="filters" (ngSubmit)="saveLayout.emit()">
          <label>
            Origin X ({{ lengthUnit(units()) }})
            <input
              type="number"
              [step]="lengthStep(units())"
              name="originX"
              [value]="lengthInput(geo.originXInches, units())"
              (input)="typed('originXInches', $event)"
              (change)="typed('originXInches', $event)"
            />
          </label>
          <label>
            Origin Y ({{ lengthUnit(units()) }})
            <input
              type="number"
              [step]="lengthStep(units())"
              name="originY"
              [value]="lengthInput(geo.originYInches, units())"
              (input)="typed('originYInches', $event)"
              (change)="typed('originYInches', $event)"
            />
          </label>
          <label>
            Length ({{ lengthUnit(units()) }})
            <input
              type="number"
              [min]="lengthStep(units())"
              [step]="lengthStep(units())"
              name="length"
              [value]="lengthInput(geo.lengthInches, units())"
              (input)="typed('lengthInches', $event)"
              (change)="typed('lengthInches', $event)"
            />
          </label>
          <label>
            Width ({{ lengthUnit(units()) }})
            <input
              type="number"
              [min]="lengthStep(units())"
              [step]="lengthStep(units())"
              name="width"
              [value]="lengthInput(geo.widthInches, units())"
              (input)="typed('widthInches', $event)"
              (change)="typed('widthInches', $event)"
            />
          </label>
        </form>
      }
      <div class="filters">
        <button type="button" class="btn btn-secondary" (click)="rotate.emit()">Rotate 90°</button>
        @if (!confirming()) {
          <button
            type="button"
            class="btn btn-secondary"
            [attr.aria-label]="'Delete bed ' + b.name"
            (click)="confirmFor.set(b.id)"
          >
            Delete
          </button>
        }
        <button type="button" class="btn btn-secondary" (click)="done.emit()">Done</button>
      </div>
      @if (confirming()) {
        <p>
          Permanently delete {{ b.name }}? Direct-seed plantings in this bed will be deleted.
          Transplants return to the tray.
        </p>
        <div class="filters">
          <button
            type="button"
            class="btn btn-destructive"
            [attr.aria-label]="'Confirm delete ' + b.name"
            (click)="remove.emit()"
            [attr.aria-busy]="deleting() || null"
            [disabled]="deleting()"
          >
            Confirm delete
          </button>
          <button type="button" class="btn btn-secondary" (click)="confirmFor.set(null)">
            Cancel
          </button>
        </div>
      }
    </section>
  `,
})
export class LayoutBedInspector {
  readonly units = inject(AuthApiService).units;
  readonly lengthInput = lengthInput;
  readonly lengthStep = lengthStep;
  readonly lengthUnit = lengthUnit;
  readonly mulches = MULCHES;
  readonly mulchLabels = MULCH_LABELS;

  bed = input.required<LayoutBedDto>();
  /** The server has this bed, so its name and settings can change now. */
  saved = input(false);
  deleting = input(false);
  /** Areas the bed can be moved to. */
  areas = input<PropertyAreaDto[]>([]);
  /** Moves the bed; resolves false when the area refused it. */
  moveToArea = input<(bed: LayoutBedDto, areaId: string) => Promise<boolean>>(async () => false);

  async pickArea(event: Event) {
    const select = event.target as HTMLSelectElement;
    const bed = this.bed();
    if (!select.value || select.value === bed.areaId) return;
    // A refused move puts the picker back where the bed still is.
    if (!(await this.moveToArea()(bed, select.value))) select.value = bed.areaId ?? '';
  }

  /** The bed's area's latest test, which applies while the bed has none of its own. */
  areaSoilTest = input<{ name: string; test: SoilTestDto } | null>(null);
  saveSoilTest =
    input.required<(owner: SoilTestOwner, test: SoilTestCreateDto) => Promise<boolean>>();
  deleteSoilTest = input.required<(owner: SoilTestOwner, test: SoilTestDto) => Promise<boolean>>();
  readonly saveTest = (test: SoilTestCreateDto) =>
    this.saveSoilTest()({ bedId: this.bed().id }, test);
  readonly deleteTest = (test: SoilTestDto) =>
    this.deleteSoilTest()({ bedId: this.bed().id }, test);
  settings = output<BedSettingsPatch>();
  geometryChange = output<Partial<BedGeometryDto>>();
  rotate = output<void>();
  remove = output<void>();
  done = output<void>();
  saveLayout = output<void>();

  private readonly bedId = computed(() => this.bed().id);
  /** The name as typed; starts over when another bed is selected, not when this one moves. */
  renameDraft = linkedSignal({
    source: this.bedId,
    computation: () => untracked(this.bed).name,
  });
  /** The bed whose delete is waiting for a confirm. */
  confirmFor = signal<string | null>(null);
  confirming = computed(() => this.confirmFor() === this.bedId());

  /**
   * A position or size field. Feet apply as they are typed; metres apply
   * when the field is left, since the half-foot grid would rewrite a metric
   * value mid-entry.
   */
  typed(key: GeometryField, event: Event) {
    const metric = this.units() === 'metric';
    if (metric !== (event.type === 'change')) return;
    const value = (event.target as HTMLInputElement).value;
    const inches = snapHalfFoot(inchesFromInput(value, this.units()));
    const size = key === 'lengthInches' || key === 'widthInches';
    this.geometryChange.emit({ [key]: size ? Math.max(HALF_FOOT_INCHES, inches) : inches });
  }
}
