import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  originFromCenter,
  drawableBeds,
  convertLength,
  formatPlanSize,
  inchesFromInput,
  lengthInput,
  lengthStep,
  lengthUnit,
  snapHalfFoot,
  clampSizeToPlot,
  clampOriginToPlot,
  HALF_FOOT_INCHES,
  bedPlanSize,
} from '@open-garden/garden-layout';
import { rotateBed90 } from '@open-garden/garden-layout/rotate';
import type {
  BedGeometryDto,
  BedSite,
  LayoutAreaDto,
  LayoutBedDto,
  Mulch,
  PropertyAreaDto,
  TrayDto,
  Units,
} from '@open-garden/shared-types';
import { MULCH_LABELS, mulchOrNone } from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { PlantingsApiService } from './plantings-api.service';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { AuthApiService } from '../auth/auth-api.service';
import { PlaceMarker } from '../ui/place-marker';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, GardenPlanCanvas, PlaceMarker, EmptyState],
  template: `
    <div class="planner">
      <header class="page-head">
        <div>
          <og-place-marker
            [gardenId]="gardenId"
            [gardenName]="gardenName()"
            current="Garden Overview"
          />
          <h2>Garden Overview</h2>
        </div>
        @if (!loading() && draft()) {
          <div class="planner-toolbar">
            <button type="button" class="btn btn-secondary" (click)="zoomIn()">Zoom in</button>
            <button type="button" class="btn btn-secondary" (click)="zoomOut()">Zoom out</button>
            @if (canEdit()) {
              <div class="add-menu">
                <button
                  type="button"
                  class="btn btn-secondary"
                  aria-haspopup="true"
                  [attr.aria-expanded]="addMenuOpen()"
                  (click)="addMenuOpen.set(!addMenuOpen())"
                >
                  Add
                </button>
                @if (addMenuOpen()) {
                  <div class="add-menu-list" role="group" aria-label="Add to the plan">
                    <button type="button" aria-label="Add bed" (click)="startAdding('bed')">
                      Bed
                    </button>
                    <button
                      type="button"
                      aria-label="Add vegetable garden"
                      [disabled]="!areasLoaded()"
                      (click)="addVegetable()"
                    >
                      Vegetable garden
                    </button>
                    <button type="button" aria-label="Add tree" (click)="addStation('tree')">
                      Tree
                    </button>
                    <button
                      type="button"
                      aria-label="Add bramble patch"
                      (click)="addStation('berry')"
                    >
                      Bramble patch
                    </button>
                    <button type="button" aria-label="Add tray" (click)="startAdding('tray')">
                      Tray
                    </button>
                    <button type="button" aria-label="Add walkway" (click)="startAdding('walkway')">
                      Walkway
                    </button>
                  </div>
                }
              </div>
              <button
                type="button"
                class="btn btn-primary"
                (click)="save()"
                [attr.aria-busy]="notices.busyMap().has('save-layout') || null"
                [disabled]="notices.busyMap().has('save-layout')"
              >
                Save layout
              </button>
            }
          </div>
        }
      </header>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (status()) {
        <p role="status">{{ status() }}</p>
      }
      @if (canEdit() && needsSite()) {
        <p class="banner" role="status">
          Set zone and frost dates so the calendar can show sow windows.
          <a [routerLink]="['/gardens', gardenId, 'configure']">Set your site</a>
        </p>
      }
      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else if (!draft()) {
        <p class="muted">Garden unavailable or not found.</p>
      } @else {
        <div class="planner-alerts">
          @if (dirty()) {
            <p role="status">Unsaved changes</p>
          }
          @if (atGardenEdge()) {
            <p role="status">At the garden edge</p>
          }
          @for (flag of flags(); track $index) {
            <p class="needs-attention" role="status">
              @if (flag.message) {
                {{ flag.message }}
              } @else if (flag.kind === 'spacing') {
                Too close
              } @else if (flag.kind === 'fit') {
                Past the bed edge
              } @else {
                Spacing unavailable
              }
            </p>
          }
        </div>
        <div class="planner-stage">
          <og-garden-plan-canvas
            [beds]="draft()!.beds"
            [areas]="draft()!.areas"
            [plantings]="draft()!.plantings"
            [priorCrops]="draft()!.priorCrops ?? []"
            [selectedId]="selectedId()"
            [canEdit]="canEdit()"
            [online]="online()"
            [allowPlantingDrag]="false"
            [showPlantingMarks]="false"
            [allowBedGeometry]="true"
            [planLabel]="'Garden plan'"
            [plotLengthInches]="plotLength()"
            [plotWidthInches]="plotWidth()"
            (focusBed)="editGeometry($event)"
            (bedGeometry)="onBedGeometry($event)"
            (areaGeometry)="onAreaGeometry($event)"
            (gestureEnd)="refreshFlags()"
            (offlineRequired)="onOfflineRequired()"
          />
          <aside class="planner-rail">
            @if (canEdit() && addingNow() === 'bed') {
              <form class="inspector" aria-label="New bed" (ngSubmit)="createBed()">
                <h3>New bed</h3>
                @if (!draft()!.beds.length) {
                  <p class="muted">{{ emptyBedBody() }}</p>
                }
                <label>
                  Name
                  <input [(ngModel)]="newBedName" name="bedName" placeholder="Bed name" />
                </label>
                <label>
                  Length ({{ lengthUnit(units()) }})
                  <input
                    type="number"
                    [min]="lengthStep(units())"
                    [step]="lengthStep(units())"
                    [(ngModel)]="newLength"
                    name="newLength"
                  />
                </label>
                <label>
                  Width ({{ lengthUnit(units()) }})
                  <input
                    type="number"
                    [min]="lengthStep(units())"
                    [step]="lengthStep(units())"
                    [(ngModel)]="newWidth"
                    name="newWidth"
                  />
                </label>
                <label>
                  Ground
                  <select name="bedSite" [(ngModel)]="bedSite">
                    <option value="in_ground">In-ground</option>
                    <option value="raised">Raised</option>
                  </select>
                </label>
                <label>
                  Mulch
                  <select name="bedMulch" [(ngModel)]="bedMulch">
                    @for (choice of mulchChoices; track choice.id) {
                      <option [value]="choice.id">{{ choice.label }}</option>
                    }
                  </select>
                </label>
                <div class="filters">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [attr.aria-busy]="notices.busyMap().has('create-bed') || null"
                    [disabled]="notices.busyMap().has('create-bed')"
                  >
                    Create bed
                  </button>
                  @if (draft()!.beds.length) {
                    <button type="button" class="btn btn-secondary" (click)="adding.set(null)">
                      Cancel
                    </button>
                  }
                </div>
              </form>
            } @else if (canEdit() && addingNow() === 'tray') {
              <form class="inspector" aria-label="New tray" (ngSubmit)="addTray()">
                <h3>New tray</h3>
                <label>
                  Name
                  <input [(ngModel)]="trayName" name="trayName" placeholder="Tray name" />
                </label>
                <div class="filters">
                  <button type="submit" class="btn btn-primary">Create tray</button>
                  <button type="button" class="btn btn-secondary" (click)="adding.set(null)">
                    Cancel
                  </button>
                </div>
              </form>
            } @else if (canEdit() && addingNow() === 'walkway') {
              <form class="inspector" aria-label="New walkway" (ngSubmit)="createArea()">
                <h3>New walkway</h3>
                <label>
                  Name
                  <input [(ngModel)]="newAreaName" name="areaName" placeholder="Area name" />
                </label>
                <label>
                  Length ({{ lengthUnit(units()) }})
                  <input
                    type="number"
                    [min]="lengthStep(units())"
                    [step]="lengthStep(units())"
                    [(ngModel)]="newAreaLength"
                    name="newAreaLength"
                  />
                </label>
                <label>
                  Width ({{ lengthUnit(units()) }})
                  <input
                    type="number"
                    [min]="lengthStep(units())"
                    [step]="lengthStep(units())"
                    [(ngModel)]="newAreaWidth"
                    name="newAreaWidth"
                  />
                </label>
                <div class="filters">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    aria-label="Create non-planting area"
                  >
                    Create walkway
                  </button>
                  <button type="button" class="btn btn-secondary" (click)="adding.set(null)">
                    Cancel
                  </button>
                </div>
              </form>
            } @else if (canEdit() && selectedBed(); as bed) {
              <section class="inspector" aria-label="Selected bed">
                <h3>{{ bed.name }}</h3>
                @if (isSaved(bed)) {
                  <form class="filters" (ngSubmit)="saveBedSettings(bed, { name: renameDraft })">
                    <label>
                      Name
                      <input name="selectedName" [(ngModel)]="renameDraft" />
                    </label>
                    <button
                      type="submit"
                      class="btn btn-secondary"
                      [attr.aria-label]="'Rename ' + bed.name"
                    >
                      Rename
                    </button>
                  </form>
                  <label>
                    Sun
                    <select
                      name="selectedSun"
                      [ngModel]="bed.sun ?? ''"
                      (ngModelChange)="saveBedSettings(bed, { sun: $event || null })"
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
                      [ngModel]="bed.site ?? 'in_ground'"
                      (ngModelChange)="saveBedSettings(bed, { site: $event })"
                    >
                      <option value="in_ground">In-ground</option>
                      <option value="raised">Raised</option>
                    </select>
                  </label>
                  <label>
                    Mulch
                    <select
                      name="selectedMulch"
                      [ngModel]="bed.mulch ?? 'none'"
                      (ngModelChange)="saveBedSettings(bed, { mulch: $event })"
                    >
                      @for (choice of mulchChoices; track choice.id) {
                        <option [value]="choice.id">{{ choice.label }}</option>
                      }
                    </select>
                  </label>
                } @else {
                  <p class="muted">Save the layout to set its name, sun, ground, and mulch.</p>
                }
                @if (bed.geometry) {
                  <form class="filters" (ngSubmit)="save()">
                    <label>
                      Origin X ({{ lengthUnit(units()) }})
                      <input
                        type="number"
                        [step]="lengthStep(units())"
                        name="originX"
                        [value]="lengthInput(bed.geometry.originXInches, units())"
                        (input)="patchField('originXInches', $event)"
                        (change)="patchField('originXInches', $event)"
                      />
                    </label>
                    <label>
                      Origin Y ({{ lengthUnit(units()) }})
                      <input
                        type="number"
                        [step]="lengthStep(units())"
                        name="originY"
                        [value]="lengthInput(bed.geometry.originYInches, units())"
                        (input)="patchField('originYInches', $event)"
                        (change)="patchField('originYInches', $event)"
                      />
                    </label>
                    <label>
                      Length ({{ lengthUnit(units()) }})
                      <input
                        type="number"
                        [min]="lengthStep(units())"
                        [step]="lengthStep(units())"
                        name="length"
                        [value]="lengthInput(bed.geometry.lengthInches, units())"
                        (input)="patchField('lengthInches', $event)"
                        (change)="patchField('lengthInches', $event)"
                      />
                    </label>
                    <label>
                      Width ({{ lengthUnit(units()) }})
                      <input
                        type="number"
                        [min]="lengthStep(units())"
                        [step]="lengthStep(units())"
                        name="width"
                        [value]="lengthInput(bed.geometry.widthInches, units())"
                        (input)="patchField('widthInches', $event)"
                        (change)="patchField('widthInches', $event)"
                      />
                    </label>
                  </form>
                }
                <div class="filters">
                  <button type="button" class="btn btn-secondary" (click)="rotateSelected()">
                    Rotate 90°
                  </button>
                  @if (confirmDeleteId() !== bed.id) {
                    <button
                      type="button"
                      class="btn btn-secondary"
                      [attr.aria-label]="'Delete bed ' + bed.name"
                      (click)="confirmDeleteId.set(bed.id)"
                    >
                      Delete
                    </button>
                  }
                  <button type="button" class="btn btn-secondary" (click)="selectedId.set(null)">
                    Done
                  </button>
                </div>
                @if (confirmDeleteId() === bed.id) {
                  <p>
                    Permanently delete {{ bed.name }}? Direct-seed plantings in this bed will be
                    deleted. Transplants return to the tray.
                  </p>
                  <div class="filters">
                    <button
                      type="button"
                      class="btn btn-destructive"
                      [attr.aria-label]="'Confirm delete ' + bed.name"
                      (click)="deleteBed(bed)"
                      [attr.aria-busy]="notices.busyMap().has('delete-bed') || null"
                      [disabled]="notices.busyMap().has('delete-bed')"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary"
                      (click)="confirmDeleteId.set(null)"
                    >
                      Cancel
                    </button>
                  </div>
                }
              </section>
            }
            @if (!draft()!.beds.length && !canEdit()) {
              <og-empty-state title="No beds yet" [body]="emptyBedBody()" />
            }
            @if (sizedBeds().length) {
              <h3>Beds</h3>
              <ul class="card-list">
                @for (bed of sizedBeds(); track bed.id) {
                  <li class="row" [class.selected-row]="selectedId() === bed.id">
                    <span>
                      <strong>{{ bed.name }}</strong>
                      @if (showMulch(bed)) {
                        <span class="muted"> · {{ mulchLabel(bed.mulch) }}</span>
                      }
                      @if (bed.geometry; as geo) {
                        <span class="muted">
                          ·
                          {{
                            formatPlanSize(
                              geo.lengthInches,
                              geo.widthInches,
                              geo.orientation,
                              units()
                            )
                          }}
                        </span>
                      }
                    </span>
                    <span class="member-actions">
                      <button
                        type="button"
                        class="btn btn-secondary"
                        [attr.aria-label]="'Open bed ' + bed.name"
                        (click)="openBed(bed.id)"
                      >
                        Open
                      </button>
                      @if (canEdit()) {
                        <button
                          type="button"
                          class="btn btn-secondary"
                          [attr.aria-label]="'Edit bed ' + bed.name"
                          (click)="editGeometry(bed.id)"
                        >
                          Edit
                        </button>
                      }
                    </span>
                  </li>
                }
              </ul>
            }
            @if (draft()!.areas.length) {
              <h3>Walkways</h3>
              <ul class="card-list">
                @for (area of draft()!.areas; track area.id) {
                  <li class="stack">
                    <span
                      >{{ area.name }} ·
                      {{
                        formatPlanSize(area.lengthInches, area.widthInches, undefined, units())
                      }}</span
                    >
                    @if (canEdit()) {
                      @if (confirmDeleteAreaId() !== area.id) {
                        <button
                          type="button"
                          class="btn btn-secondary"
                          [attr.aria-label]="'Delete area ' + area.name"
                          (click)="confirmDeleteAreaId.set(area.id)"
                        >
                          Delete
                        </button>
                      } @else {
                        <p>Permanently delete {{ area.name }}?</p>
                        <button
                          type="button"
                          class="btn btn-destructive"
                          [attr.aria-label]="'Confirm delete ' + area.name"
                          (click)="deleteArea(area)"
                          [attr.aria-busy]="notices.busyMap().has('delete-area') || null"
                          [disabled]="notices.busyMap().has('delete-area')"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          class="btn btn-secondary"
                          (click)="confirmDeleteAreaId.set(null)"
                        >
                          Cancel
                        </button>
                      }
                    }
                  </li>
                }
              </ul>
            }
            @if (canEdit() && (areas().length || trays().length)) {
              <h3>Areas</h3>
              <ul class="card-list">
                @for (area of areas(); track area.id) {
                  <li [attr.data-area-kind]="area.kind">{{ area.name }}</li>
                }
                @for (tray of trays(); track tray.id) {
                  <li>{{ tray.name }}</li>
                }
              </ul>
            }
          </aside>
        </div>
      }
    </div>
  `,
})
export class GardenLayoutPage implements OnInit {
  private readonly api = inject(LayoutApiService);
  private readonly gardensApi = inject(GardensApiService);
  private readonly bedsApi = inject(PlantingsApiService);
  private readonly planner = inject(PlannerDraftService);
  readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly canvas = viewChild(GardenPlanCanvas);
  gardenId = '';
  gardenName = signal('Garden');
  plotLength = signal<number | null>(null);
  plotWidth = signal<number | null>(null);
  readonly draft = this.planner.draft;
  readonly loading = this.planner.loading;
  readonly flags = this.planner.flags;
  error = signal('');
  status = signal('');
  needsSite = signal(false);
  selectedId = signal<string | null>(null);
  readonly addMenuOpen = signal(false);
  /** The create form open in the side panel, chosen from the Add menu. */
  readonly adding = signal<'bed' | 'tray' | 'walkway' | null>(null);
  renameDraft = '';
  confirmDeleteId = signal<string | null>(null);
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  newBedName = '';
  readonly units = inject(AuthApiService).units;
  /** Units the add forms are typed in; a switch converts what is typed. */
  addUnits: Units = this.units();
  newLength: number | null = lengthInput(96, this.addUnits);
  newWidth: number | null = lengthInput(48, this.addUnits);
  bedSite: BedSite = 'in_ground';
  bedMulch: Mulch = 'none';
  pendingStation: 'tree' | 'berry' | null = null;
  trayName = '';
  readonly areas = signal<PropertyAreaDto[]>([]);
  /** False until the first areas request settles, so "Add vegetable garden" cannot duplicate one not yet shown. */
  readonly areasLoaded = signal(false);
  readonly trays = signal<TrayDto[]>([]);
  readonly mulchChoices: { id: Mulch; label: string }[] = [
    { id: 'none', label: 'No mulch' },
    { id: 'wood_chips', label: 'Wood chips' },
    { id: 'straw', label: 'Straw' },
    { id: 'leaves', label: 'Leaves' },
    { id: 'compost', label: 'Compost' },
    { id: 'paper', label: 'Paper' },
    { id: 'plastic', label: 'Plastic' },
  ];
  newAreaName = '';
  newAreaLength: number | null = lengthInput(48, this.addUnits);
  newAreaWidth: number | null = lengthInput(48, this.addUnits);
  private readonly followUnits = effect(() => {
    const units = this.units();
    untracked(() => {
      if (units === this.addUnits) return;
      const from = this.addUnits;
      const convert = (value: number | null) =>
        value == null ? null : convertLength(value, from, units);
      this.newLength = convert(this.newLength);
      this.newWidth = convert(this.newWidth);
      this.newAreaLength = convert(this.newAreaLength);
      this.newAreaWidth = convert(this.newAreaWidth);
      this.addUnits = units;
    });
  });
  confirmDeleteAreaId = signal<string | null>(null);
  readonly formatPlanSize = formatPlanSize;
  readonly lengthInput = lengthInput;
  readonly lengthStep = lengthStep;
  readonly lengthUnit = lengthUnit;

  /**
   * A selected bed's position or size field. Feet apply as they are typed;
   * metres apply when the field is left, since the half-foot grid would
   * rewrite a metric value mid-entry.
   */
  patchField(
    key: 'originXInches' | 'originYInches' | 'lengthInches' | 'widthInches',
    event: Event,
  ) {
    const metric = this.units() === 'metric';
    if (metric !== (event.type === 'change')) return;
    const value = (event.target as HTMLInputElement).value;
    const inches = snapHalfFoot(inchesFromInput(value, this.units()));
    const size = key === 'lengthInches' || key === 'widthInches';
    this.patchSelected({ [key]: size ? Math.max(HALF_FOOT_INCHES, inches) : inches });
  }

  atGardenEdge() {
    return this.canvas()?.atPlotEdge() ?? false;
  }

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
  }

  @HostListener('document:keydown.escape')
  closeAddMenu() {
    this.addMenuOpen.set(false);
  }

  @HostListener('window:online')
  onWindowOnline() {
    this.online.set(true);
  }

  @HostListener('window:offline')
  onWindowOffline() {
    this.online.set(false);
  }

  canEdit() {
    const role = this.draft()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  dirty() {
    return this.planner.dirty();
  }

  sizedBeds() {
    return drawableBeds(this.draft()?.beds ?? []);
  }

  openBed(id: string) {
    if (!id) return;
    void this.router.navigate(['/gardens', this.gardenId, 'layout', 'beds', id]);
  }

  editGeometry(id: string) {
    this.adding.set(null);
    this.confirmDeleteId.set(null);
    this.selectedId.set(id);
    this.renameDraft = this.draft()?.beds.find((b) => b.id === id)?.name ?? '';
  }

  /** The open create form; an empty property opens on the bed form. */
  addingNow() {
    return this.adding() ?? (this.draft()?.beds.length ? null : 'bed');
  }

  startAdding(kind: 'bed' | 'tray' | 'walkway') {
    this.addMenuOpen.set(false);
    this.selectedId.set(null);
    this.adding.set(kind);
  }

  selectedBed() {
    const id = this.selectedId();
    return id ? (this.draft()?.beds.find((b) => b.id === id) ?? null) : null;
  }

  /** A bed the server has, so its name and settings can be changed now. */
  isSaved(bed: LayoutBedDto) {
    return !this.planner.newBedIds.has(bed.id);
  }

  async saveBedSettings(
    bed: LayoutBedDto,
    patch: { name?: string; sun?: string | null; site?: string; mulch?: string },
  ) {
    this.error.set('');
    const name = (patch.name ?? bed.name).trim();
    if (!name) return;
    const sun =
      patch.sun === undefined
        ? undefined
        : patch.sun === 'full' || patch.sun === 'part' || patch.sun === 'shade'
          ? patch.sun
          : null;
    const site: BedSite | undefined =
      patch.site === undefined ? undefined : patch.site === 'raised' ? 'raised' : 'in_ground';
    const mulch = patch.mulch === undefined ? undefined : mulchOrNone(patch.mulch);
    try {
      await this.bedsApi.renameBed(this.gardenId, bed.id, name, sun, { site, mulch });
      const d = this.draft();
      if (!d) return;
      // Name and settings are not part of the layout save, so this keeps the draft clean.
      this.planner.setDraft({
        ...d,
        beds: d.beds.map((b) =>
          b.id === bed.id
            ? {
                ...b,
                name,
                ...(sun !== undefined ? { sun } : {}),
                ...(site ? { site } : {}),
                ...(mulch ? { mulch } : {}),
              }
            : b,
        ),
      });
      this.renameDraft = name;
    } catch (err) {
      this.fail(err);
    }
  }

  zoomIn() {
    this.canvas()?.zoomIn();
  }

  zoomOut() {
    this.canvas()?.zoomOut();
  }

  patchSelected(patch: Partial<BedGeometryDto>) {
    if (!this.guardMutate()) {
      const d = this.draft();
      if (d) this.planner.setDraft({ ...d, beds: d.beds.map((b) => ({ ...b })) });
      return;
    }
    const id = this.selectedId();
    const d = this.draft();
    if (!id || !d) return;
    const snapSize = patch.lengthInches !== undefined || patch.widthInches !== undefined;
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) =>
        b.id === id && b.geometry
          ? { ...b, geometry: this.placeBed({ ...b.geometry, ...patch }, snapSize) }
          : b,
      ),
    });
    this.refreshFlags();
  }

  rotateSelected() {
    if (!this.guardMutate()) return;
    const id = this.selectedId();
    const d = this.draft();
    if (!id || !d) return;
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) =>
        // false: keep length and width. Only the origin shifts to stay inside the plot.
        b.id === id && b.geometry
          ? { ...b, geometry: this.placeBed(rotateBed90(b.geometry), false) }
          : b,
      ),
    });
    this.refreshFlags();
  }

  emptyBedBody() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return new OnlineRequiredError().message;
    }
    return 'Add a named bed with length and width to draw the garden to scale.';
  }

  async load() {
    this.needsSite.set(false);
    const [, detail] = await Promise.all([
      this.planner.load(this.gardenId, { reuseDirty: true }),
      this.gardensApi.detail(this.gardenId),
    ]);
    if (detail) {
      this.gardenName.set(detail.name);
      this.plotLength.set(detail.lengthInches ?? null);
      this.plotWidth.set(detail.widthInches ?? null);
      this.needsSite.set(!detail.frostFree && (!detail.lastFrost || !detail.firstFrost));
    }
    await this.loadAreas();
  }

  mulchLabel(mulch: Mulch | null | undefined) {
    return mulch ? MULCH_LABELS[mulch] : '';
  }

  showMulch(bed: LayoutBedDto) {
    return !!bed.mulch && bed.mulch !== 'none';
  }

  async loadAreas() {
    try {
      const [areas, trays] = await Promise.all([
        this.gardensApi.areas(this.gardenId),
        this.gardensApi.trays(this.gardenId),
      ]);
      this.areas.set(areas);
      this.trays.set(trays);
    } catch (err) {
      this.error.set(messageFrom(err));
    } finally {
      this.areasLoaded.set(true);
    }
  }

  async addVegetable() {
    this.addMenuOpen.set(false);
    this.error.set('');
    if (!this.guardMutate()) return;
    try {
      await this.gardensApi.createArea(this.gardenId, 'vegetable');
      await this.loadAreas();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  addStation(station: 'tree' | 'berry') {
    this.addMenuOpen.set(false);
    this.newBedName = station === 'tree' ? 'Tree' : 'Canes';
    // A tree bed (8 × 8 ft), or a row of canes in a bramble patch (10 × 3 ft).
    this.newLength = lengthInput(station === 'tree' ? 96 : 120, this.addUnits);
    this.newWidth = lengthInput(station === 'tree' ? 96 : 36, this.addUnits);
    this.pendingStation = station;
    void this.createBed().finally(() => {
      this.newLength = lengthInput(96, this.addUnits);
      this.newWidth = lengthInput(48, this.addUnits);
    });
  }

  async addTray() {
    this.error.set('');
    if (!this.guardMutate()) return;
    const name = this.trayName.trim() || 'Tray';
    try {
      await this.gardensApi.createTray(this.gardenId, name);
      this.trayName = '';
      this.adding.set(null);
      await this.loadAreas();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async createBed() {
    const station = this.pendingStation;
    this.pendingStation = null;
    const d = this.draft();
    if (!d) return;
    this.error.set('');
    this.status.set('');
    if (!this.guardMutate()) return;
    const name = this.newBedName.trim();
    const length = inchesFromInput(this.newLength ?? 0, this.addUnits);
    const width = inchesFromInput(this.newWidth ?? 0, this.addUnits);
    if (!name || length < 1 || width < 1) return;
    const id = crypto.randomUUID();
    const center = this.canvas()?.viewportCenterPlan() ?? { x: 0, y: 0 };
    const origin = originFromCenter(center.x, center.y, length, width);
    const geometry = this.placeBed(
      {
        originXInches: origin.originXInches,
        originYInches: origin.originYInches,
        lengthInches: length,
        widthInches: width,
        orientation: 0,
      },
      true,
    );
    this.planner.newBedIds.add(id);
    this.planner.setDraft({
      ...d,
      beds: [
        ...d.beds,
        {
          id,
          name,
          geometry,
          site: this.bedSite,
          mulch: this.bedMulch,
          ...(station ? { station } : {}),
        },
      ],
    });
    this.adding.set(null);
    this.editGeometry(id);
    this.newBedName = '';
    this.refreshFlags();
  }

  async createArea() {
    const d = this.draft();
    if (!d || !this.guardMutate()) return;
    const name = this.newAreaName.trim();
    const length = inchesFromInput(this.newAreaLength ?? 0, this.addUnits);
    const width = inchesFromInput(this.newAreaWidth ?? 0, this.addUnits);
    if (!name || length < 1 || width < 1) return;
    const id = crypto.randomUUID();
    const center = this.canvas()?.viewportCenterPlan() ?? { x: 0, y: 0 };
    const origin = originFromCenter(center.x, center.y, length, width);
    const placed = this.placeArea({
      id,
      name,
      originXInches: origin.originXInches,
      originYInches: origin.originYInches,
      lengthInches: length,
      widthInches: width,
    });
    this.planner.setDraft({ ...d, areas: [...(d.areas ?? []), placed] });
    this.newAreaName = '';
    this.adding.set(null);
  }

  async deleteArea(area: LayoutAreaDto) {
    this.error.set('');
    if (!this.guardMutate()) return;
    const d = this.draft();
    if (!d) return;
    const inSaved = this.planner.savedPutJson.includes(area.id);
    if (!inSaved) {
      this.planner.setDraft({ ...d, areas: (d.areas ?? []).filter((a) => a.id !== area.id) });
      this.confirmDeleteAreaId.set(null);
      return;
    }
    await this.notices.run('delete-area', async () => {
      try {
        await this.api.deleteArea(this.gardenId, area.id);
        this.planner.setDraft({ ...d, areas: (d.areas ?? []).filter((a) => a.id !== area.id) });
        this.confirmDeleteAreaId.set(null);
      } catch (err) {
        this.fail(err);
      }
    });
  }

  async deleteBed(bed: LayoutBedDto) {
    this.error.set('');
    if (!this.guardMutate()) return;
    if (this.planner.newBedIds.has(bed.id)) {
      const d = this.draft();
      if (!d) return;
      this.planner.newBedIds.delete(bed.id);
      this.planner.setDraft({
        ...d,
        beds: d.beds.filter((b) => b.id !== bed.id),
        plantings: d.plantings.map((p) =>
          p.bedId === bed.id || p.placement?.bedId === bed.id
            ? { ...p, bedId: null, placement: null }
            : p,
        ),
      });
      this.confirmDeleteId.set(null);
      this.refreshFlags();
      return;
    }
    await this.notices.run('delete-bed', async () => {
      try {
        await this.api.deleteBed(this.gardenId, bed.id);
        this.confirmDeleteId.set(null);
        await this.load();
      } catch (err) {
        this.fail(err);
      }
    });
  }

  onBedGeometry(ev: { bedId: string; geometry: BedGeometryDto }) {
    if (!this.guardMutate()) return;
    const d = this.draft();
    if (!d) return;
    const current = d.beds.find((b) => b.id === ev.bedId)?.geometry;
    const snapSize =
      !current ||
      current.lengthInches !== ev.geometry.lengthInches ||
      current.widthInches !== ev.geometry.widthInches;
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) =>
        b.id === ev.bedId ? { ...b, geometry: this.placeBed(ev.geometry, snapSize) } : b,
      ),
    });
  }

  onAreaGeometry(ev: { area: LayoutAreaDto }) {
    if (!this.guardMutate()) return;
    const d = this.draft();
    if (!d) return;
    this.planner.setDraft({
      ...d,
      areas: (d.areas ?? []).map((a) => (a.id === ev.area.id ? this.placeArea(ev.area) : a)),
    });
  }

  onOfflineRequired() {
    this.fail(new OnlineRequiredError());
  }

  refreshFlags() {
    this.planner.refreshFlags();
  }

  async save() {
    this.error.set('');
    this.status.set('');
    await this.notices.run('save-layout', async () => {
      if (!this.guardMutate()) return;
      this.planner.refreshFlags();
      try {
        await this.planner.save();
        this.notices.success('Layout saved');
      } catch (err) {
        this.fail(err);
      }
    });
  }

  /** Garden length and width, when the gardener set them. The camera is not a boundary. */
  private configuredPlot() {
    const length = this.plotLength();
    const width = this.plotWidth();
    if (length == null || width == null) return null;
    return { x: 0, y: 0, w: length, h: width };
  }

  private placeBed(geo: BedGeometryDto, snapSize: boolean): BedGeometryDto {
    const frame = this.configuredPlot();
    if (!frame) return geo;
    const plan = bedPlanSize(geo);
    const size = snapSize
      ? clampSizeToPlot(frame, geo.originXInches, geo.originYInches, plan.width, plan.height)
      : { width: plan.width, height: plan.height };
    const origin = clampOriginToPlot(
      frame,
      geo.originXInches,
      geo.originYInches,
      size.width,
      size.height,
    );
    const rotated = geo.orientation === 90 || geo.orientation === 270;
    return {
      ...geo,
      originXInches: origin.originXInches,
      originYInches: origin.originYInches,
      lengthInches: rotated ? size.height : size.width,
      widthInches: rotated ? size.width : size.height,
    };
  }

  private placeArea(area: LayoutAreaDto): LayoutAreaDto {
    const frame = this.configuredPlot();
    if (!frame) return area;
    const current = this.draft()?.areas.find((item) => item.id === area.id);
    const snapSize =
      !current ||
      current.lengthInches !== area.lengthInches ||
      current.widthInches !== area.widthInches;
    const size = snapSize
      ? clampSizeToPlot(
          frame,
          area.originXInches,
          area.originYInches,
          area.lengthInches,
          area.widthInches,
        )
      : { width: area.lengthInches, height: area.widthInches };
    const origin = clampOriginToPlot(
      frame,
      area.originXInches,
      area.originYInches,
      size.width,
      size.height,
    );
    return {
      ...area,
      originXInches: origin.originXInches,
      originYInches: origin.originYInches,
      lengthInches: size.width,
      widthInches: size.height,
    };
  }

  private fail(err: unknown) {
    this.notices.error(messageFrom(err));
  }

  private guardMutate(): boolean {
    if (!this.canEdit()) return false;
    try {
      this.assertOnline();
      return true;
    } catch (err) {
      this.fail(err);
      return false;
    }
  }

  private assertOnline() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OnlineRequiredError();
    }
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  if (err instanceof Error) return err.message;
  return 'Could not update layout';
}
