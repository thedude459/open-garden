import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { evaluateLayout } from '@open-garden/garden-layout/evaluate';
import { bedPlanSize, localToPlan, rotateBed90 } from '@open-garden/garden-layout/rotate';
import type {
  BedGeometryDto,
  GardenLayoutDto,
  LayoutBedDto,
  LayoutFlagDto,
  LayoutPlantingDto,
  LayoutPutDto,
} from '@open-garden/shared-types';
import { LayoutApiService } from './layout-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { OnlineRequiredError } from './gardens-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <p><a [routerLink]="['/gardens', gardenId]">Back to garden</a></p>
    <h2>Layout</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!draft()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (!draft()!.beds.length) {
        <p class="muted">
          Add a named bed with length and width to draw the garden to scale.
        </p>
      }
      @if (needsSize().length) {
        <h3>Needs size</h3>
        <ul class="card-list">
          @for (bed of needsSize(); track bed.id) {
            <li class="row">
              <span>{{ bed.name }}</span>
              @if (canEdit()) {
                <form class="filters" (ngSubmit)="sizeBed(bed)">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    [ngModel]="sizeLength[bed.id] ?? 96"
                    (ngModelChange)="sizeLength[bed.id] = toInt($event)"
                    [ngModelOptions]="{ standalone: true }"
                    [attr.name]="'needs-length-' + bed.id"
                    placeholder="Length (in)"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    [ngModel]="sizeWidth[bed.id] ?? 48"
                    (ngModelChange)="sizeWidth[bed.id] = toInt($event)"
                    [ngModelOptions]="{ standalone: true }"
                    [attr.name]="'needs-width-' + bed.id"
                    placeholder="Width (in)"
                  />
                  <button type="submit">Size {{ bed.name }}</button>
                </form>
              }
            </li>
          }
        </ul>
      }
      @if (canEdit()) {
        <form class="filters" (ngSubmit)="createBed()">
          <input [(ngModel)]="newBedName" name="bedName" placeholder="Bed name" />
          <input
            type="number"
            min="1"
            step="1"
            [(ngModel)]="newLength"
            name="newLength"
            placeholder="Length (in)"
          />
          <input
            type="number"
            min="1"
            step="1"
            [(ngModel)]="newWidth"
            name="newWidth"
            placeholder="Width (in)"
          />
          <button type="submit">Create bed</button>
        </form>
      }
      <div class="filters">
        <button type="button" (click)="zoomIn()">Zoom in</button>
        <button type="button" (click)="zoomOut()">Zoom out</button>
        @if (canEdit()) {
          <button type="button" (click)="save()">Save layout</button>
        }
      </div>
      @for (flag of liveFlags(); track $index) {
        <p class="needs-attention" role="status">
          @if (flag.kind === 'spacing') {
            Too close
          } @else if (flag.kind === 'fit') {
            Does not fit
          } @else {
            Spacing unavailable
          }
        </p>
      }
      <svg class="layout-plan" [attr.viewBox]="viewBox()" aria-label="Garden plan">
        @for (bed of sizedBeds(); track bed.id) {
          @if (bed.geometry; as geo) {
            <rect
              [attr.x]="geo.originXInches"
              [attr.y]="geo.originYInches"
              [attr.width]="planSize(geo).width"
              [attr.height]="planSize(geo).height"
              class="layout-bed"
              [class.selected]="selectedId() === bed.id"
              (click)="selectBed(bed.id)"
            />
            <text
              [attr.x]="geo.originXInches + 4"
              [attr.y]="geo.originYInches + 14"
              class="layout-label"
            >
              {{ bed.name }}
            </text>
            @for (planting of placedIn(bed.id); track planting.id) {
              @if (planting.placement; as place) {
                <circle
                  [attr.cx]="localToPlan(geo, place.xInches, place.yInches).x"
                  [attr.cy]="localToPlan(geo, place.xInches, place.yInches).y"
                  r="4"
                  class="layout-plant"
                />
              }
            }
          }
        }
      </svg>
      <ul class="card-list">
        @for (bed of sizedBeds(); track bed.id) {
          <li class="stack">
            <button type="button" (click)="selectBed(bed.id)">{{ bed.name }}</button>
            @if (bed.geometry; as geo) {
              <span>{{ geo.lengthInches }} × {{ geo.widthInches }} in · {{ geo.orientation }}°</span>
            }
            @if (canEdit() && selectedId() === bed.id && bed.geometry) {
              <form class="filters" (ngSubmit)="save()">
                <label>
                  Origin X
                  <input
                    type="number"
                    step="1"
                    name="originX"
                    [ngModel]="bed.geometry.originXInches"
                    (ngModelChange)="patchSelected({ originXInches: toInt($event) })"
                  />
                </label>
                <label>
                  Origin Y
                  <input
                    type="number"
                    step="1"
                    name="originY"
                    [ngModel]="bed.geometry.originYInches"
                    (ngModelChange)="patchSelected({ originYInches: toInt($event) })"
                  />
                </label>
                <label>
                  Length (in)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="length"
                    [ngModel]="bed.geometry.lengthInches"
                    (ngModelChange)="patchSelected({ lengthInches: toInt($event) })"
                  />
                </label>
                <label>
                  Width (in)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="width"
                    [ngModel]="bed.geometry.widthInches"
                    (ngModelChange)="patchSelected({ widthInches: toInt($event) })"
                  />
                </label>
              </form>
              <button type="button" (click)="rotateSelected()">Rotate 90°</button>
              @if (confirmDeleteId() !== bed.id) {
                <button type="button" (click)="confirmDeleteId.set(bed.id)">
                  Delete bed {{ bed.name }}
                </button>
              } @else {
                <p>Permanently delete {{ bed.name }}? Plantings will be unassigned.</p>
                <button type="button" (click)="deleteBed(bed)">Confirm delete {{ bed.name }}</button>
                <button type="button" (click)="confirmDeleteId.set(null)">Cancel</button>
              }
            }
          </li>
        }
      </ul>
      @if (unplaced().length) {
        <h3>Unplaced</h3>
        @if (canEdit()) {
          <div class="filters">
            <select name="unplacedPlanting" [(ngModel)]="placePlantingId">
              <option value="">Choose a planting</option>
              @for (p of unplaced(); track p.id) {
                <option [value]="p.id">{{ plantingLabel(p) }}</option>
              }
            </select>
            <select name="placeBed" [(ngModel)]="placeBedId">
              <option value="">Bed</option>
              @for (b of sizedBeds(); track b.id) {
                <option [value]="b.id">{{ b.name }}</option>
              }
            </select>
            <input type="number" step="1" name="placeX" [(ngModel)]="placeX" placeholder="X (in)" />
            <input type="number" step="1" name="placeY" [(ngModel)]="placeY" placeholder="Y (in)" />
            <button type="button" (click)="place()">Place planting</button>
          </div>
        } @else {
          <ul class="card-list">
            @for (p of unplaced(); track p.id) {
              <li>{{ plantingLabel(p) }}</li>
            }
          </ul>
        }
      }
      @if (placed().length) {
        <h3>Placed</h3>
        <ul class="card-list">
          @for (p of placed(); track p.id) {
            <li class="row">
              <span>{{ plantingLabel(p) }}</span>
              @if (canEdit()) {
                <button type="button" (click)="unplace(p)">Unplace {{ p.commonName }}</button>
              }
            </li>
          }
        </ul>
      }
    }
  `,
})
export class GardenLayoutPage implements OnInit {
  private readonly api = inject(LayoutApiService);
  private readonly plantings = inject(PlantingsApiService);
  private readonly route = inject(ActivatedRoute);
  gardenId = '';
  draft = signal<GardenLayoutDto | null>(null);
  loading = signal(true);
  error = signal('');
  selectedId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  zoom = signal(1);
  newBedName = '';
  newLength: number | null = 96;
  newWidth: number | null = 48;
  sizeLength: Record<string, number> = {};
  sizeWidth: Record<string, number> = {};
  placePlantingId = '';
  placeBedId = '';
  placeX: number | null = 24;
  placeY: number | null = 24;
  readonly localToPlan = localToPlan;
  readonly planSize = bedPlanSize;

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
  }

  canEdit() {
    const role = this.draft()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  needsSize() {
    return this.draft()?.beds.filter((b) => b.geometry === null) ?? [];
  }

  sizedBeds() {
    return this.draft()?.beds.filter((b) => b.geometry) ?? [];
  }

  unplaced() {
    return this.draft()?.plantings.filter((p) => p.placement === null) ?? [];
  }

  placed() {
    return this.draft()?.plantings.filter((p) => p.placement) ?? [];
  }

  placedIn(bedId: string) {
    return this.placed().filter((p) => p.placement?.bedId === bedId);
  }

  liveFlags(): LayoutFlagDto[] {
    const d = this.draft();
    if (!d) return [];
    return evaluateLayout(d.beds, d.plantings);
  }

  plantingLabel(p: LayoutPlantingDto) {
    return p.status === 'active' ? p.commonName : `${p.commonName} (removed from catalog)`;
  }

  viewBox() {
    const beds = this.sizedBeds();
    if (!beds.length) return '0 0 200 120';
    let maxX = 200;
    let maxY = 120;
    for (const bed of beds) {
      const geo = bed.geometry!;
      const size = bedPlanSize(geo);
      maxX = Math.max(maxX, geo.originXInches + size.width + 12);
      maxY = Math.max(maxY, geo.originYInches + size.height + 12);
    }
    const z = this.zoom();
    return `0 0 ${Math.ceil(maxX / z)} ${Math.ceil(maxY / z)}`;
  }

  selectBed(id: string) {
    this.selectedId.set(id);
  }

  zoomIn() {
    this.zoom.update((z) => Math.min(4, z + 0.25));
  }

  zoomOut() {
    this.zoom.update((z) => Math.max(0.5, z - 0.25));
  }

  toInt(value: string | number): number {
    const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  patchSelected(patch: Partial<BedGeometryDto>) {
    const id = this.selectedId();
    const d = this.draft();
    if (!id || !d) return;
    this.draft.set({
      ...d,
      beds: d.beds.map((b) =>
        b.id === id && b.geometry ? { ...b, geometry: { ...b.geometry, ...patch } } : b,
      ),
    });
  }

  rotateSelected() {
    const id = this.selectedId();
    const d = this.draft();
    if (!id || !d) return;
    this.draft.set({
      ...d,
      beds: d.beds.map((b) =>
        b.id === id && b.geometry ? { ...b, geometry: rotateBed90(b.geometry) } : b,
      ),
    });
  }

  async load() {
    this.loading.set(true);
    const layout = await this.api.get(this.gardenId);
    this.draft.set(layout);
    if (layout?.beds[0]?.geometry) this.selectedId.set(layout.beds[0].id);
    this.loading.set(false);
  }

  async sizeBed(bed: LayoutBedDto) {
    const d = this.draft();
    if (!d) return;
    const origin = this.nextOrigin(d.beds);
    const geometry: BedGeometryDto = {
      originXInches: origin.x,
      originYInches: origin.y,
      lengthInches: Math.max(1, this.sizeLength[bed.id] ?? 96),
      widthInches: Math.max(1, this.sizeWidth[bed.id] ?? 48),
      orientation: 0,
    };
    this.draft.set({
      ...d,
      beds: d.beds.map((b) => (b.id === bed.id ? { ...b, geometry } : b)),
    });
    this.selectedId.set(bed.id);
  }

  async createBed() {
    const d = this.draft();
    if (!d) return;
    this.error.set('');
    try {
      this.assertOnline();
      const name = this.newBedName.trim();
      if (!name) return;
      const bed = await this.plantings.createBed(this.gardenId, { name });
      const origin = this.nextOrigin([...d.beds, { id: bed.id, name: bed.name, geometry: null }]);
      const geometry: BedGeometryDto = {
        originXInches: origin.x,
        originYInches: origin.y,
        lengthInches: Math.max(1, this.newLength ?? 96),
        widthInches: Math.max(1, this.newWidth ?? 48),
        orientation: 0,
      };
      this.draft.set({
        ...d,
        beds: [...d.beds, { id: bed.id, name: bed.name, geometry }],
      });
      this.selectedId.set(bed.id);
      this.newBedName = '';
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async deleteBed(bed: LayoutBedDto) {
    this.error.set('');
    try {
      this.assertOnline();
      await this.plantings.deleteBed(this.gardenId, bed.id);
      this.confirmDeleteId.set(null);
      await this.load();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  place() {
    const d = this.draft();
    if (!d || !this.placePlantingId || !this.placeBedId) return;
    const x = this.placeX ?? 0;
    const y = this.placeY ?? 0;
    this.draft.set({
      ...d,
      plantings: d.plantings.map((p) =>
        p.id === this.placePlantingId
          ? {
              ...p,
              bedId: this.placeBedId,
              placement: {
                plantingId: p.id,
                bedId: this.placeBedId,
                xInches: x,
                yInches: y,
              },
            }
          : p,
      ),
    });
    this.placePlantingId = '';
  }

  unplace(planting: LayoutPlantingDto) {
    const d = this.draft();
    if (!d) return;
    this.draft.set({
      ...d,
      plantings: d.plantings.map((p) => (p.id === planting.id ? { ...p, placement: null } : p)),
    });
  }

  async save() {
    const d = this.draft();
    if (!d) return;
    this.error.set('');
    const body: LayoutPutDto = {
      beds: d.beds
        .filter((b) => b.geometry)
        .map((b) => ({
          id: b.id,
          originXInches: b.geometry!.originXInches,
          originYInches: b.geometry!.originYInches,
          lengthInches: b.geometry!.lengthInches,
          widthInches: b.geometry!.widthInches,
          orientation: b.geometry!.orientation,
        })),
      placements: d.plantings.filter((p) => p.placement).map((p) => p.placement!),
    };
    try {
      const saved = await this.api.put(this.gardenId, body);
      this.draft.set(saved);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  private nextOrigin(beds: LayoutBedDto[]): { x: number; y: number } {
    let y = 0;
    for (const bed of beds) {
      if (!bed.geometry) continue;
      const size = bedPlanSize(bed.geometry);
      y = Math.max(y, bed.geometry.originYInches + size.height);
    }
    return { x: 0, y: y === 0 ? 0 : y + 12 };
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
  return 'Could not update layout';
}
