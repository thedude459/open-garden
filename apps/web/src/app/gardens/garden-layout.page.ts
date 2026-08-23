import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { originFromCenter, drawableBeds } from '@open-garden/garden-layout';
import { rotateBed90 } from '@open-garden/garden-layout/rotate';
import type {
  BedGeometryDto,
  LayoutAreaDto,
  LayoutBedDto,
} from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { PlaceMarker } from '../ui/place-marker';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, GardenPlanCanvas, PlaceMarker, EmptyState],
  template: `
    <p><a [routerLink]="['/gardens', gardenId]">Back to garden</a></p>
    <og-place-marker [gardenId]="gardenId" [gardenName]="gardenName()" current="Garden Overview" />
    <div class="planner">
    <h2>Garden Overview</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (status()) {
      <p role="status">{{ status() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!draft()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (dirty()) {
        <p role="status">Unsaved changes</p>
      }
      @for (flag of flags(); track $index) {
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
      <div class="planner-toolbar">
        <button type="button" (click)="zoomIn()">Zoom in</button>
        <button type="button" (click)="zoomOut()">Zoom out</button>
        @if (canEdit()) {
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
        <a [routerLink]="['/gardens', gardenId, 'transplants']">Transplants</a>
      </div>
      <div class="planner-stage">
        <og-garden-plan-canvas
          [beds]="draft()!.beds"
          [areas]="draft()!.areas"
          [plantings]="draft()!.plantings"
          [selectedId]="selectedId()"
          [canEdit]="canEdit()"
          [online]="online()"
          [allowPlantingDrag]="false"
          [showPlantingMarks]="true"
          [allowBedGeometry]="true"
          [openBedOnClick]="true"
          [planLabel]="'Garden plan'"
          (selectBed)="selectBed($event)"
          (bedGeometry)="onBedGeometry($event)"
          (areaGeometry)="onAreaGeometry($event)"
          (gestureEnd)="refreshFlags()"
          (offlineRequired)="onOfflineRequired()"
        />
        <aside class="planner-rail">
          @if (!draft()!.beds.length) {
            <og-empty-state title="No beds yet" [body]="emptyBedBody()">
              @if (canEdit()) {
                <span class="muted">Use Create bed with a name, length, and width.</span>
              }
            </og-empty-state>
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
              <button
                type="submit"
                class="btn btn-primary"
                [attr.aria-busy]="notices.busyMap().has('create-bed') || null"
                [disabled]="notices.busyMap().has('create-bed')"
              >
                Create bed
              </button>
            </form>
            <form class="filters" (ngSubmit)="createArea()">
              <input [(ngModel)]="newAreaName" name="areaName" placeholder="Area name" />
              <input
                type="number"
                min="1"
                step="1"
                [(ngModel)]="newAreaLength"
                name="newAreaLength"
                placeholder="Length (in)"
              />
              <input
                type="number"
                min="1"
                step="1"
                [(ngModel)]="newAreaWidth"
                name="newAreaWidth"
                placeholder="Width (in)"
              />
              <button type="submit" class="btn btn-secondary">Create non-planting area</button>
            </form>
          }
          <ul class="card-list">
            @for (bed of sizedBeds(); track bed.id) {
              <li class="stack">
                <button type="button" (click)="selectBed(bed.id)">{{ bed.name }}</button>
                <button type="button" class="btn btn-secondary" (click)="selectBed(bed.id)">
                  Open bed {{ bed.name }}
                </button>
                <button type="button" (click)="editGeometry(bed.id)">Edit size {{ bed.name }}</button>
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
                    <p>Permanently delete {{ bed.name }}? Direct-seed plantings in this bed will be deleted. Transplants return to the tray.</p>
                    <button
                      type="button"
                      class="btn btn-destructive"
                      (click)="deleteBed(bed)"
                      [attr.aria-busy]="notices.busyMap().has('delete-bed') || null"
                      [disabled]="notices.busyMap().has('delete-bed')"
                    >
                      Confirm delete {{ bed.name }}
                    </button>
                    <button type="button" (click)="confirmDeleteId.set(null)">Cancel</button>
                  }
                }
              </li>
            }
          </ul>
          @if (draft()!.areas.length) {
            <h3>Non-planting areas</h3>
            <ul class="card-list">
              @for (area of draft()!.areas; track area.id) {
                <li class="stack">
                  <span>{{ area.name }} · {{ area.lengthInches }} × {{ area.widthInches }} in</span>
                  @if (canEdit()) {
                    @if (confirmDeleteAreaId() !== area.id) {
                      <button type="button" (click)="confirmDeleteAreaId.set(area.id)">
                        Delete area {{ area.name }}
                      </button>
                    } @else {
                      <p>Permanently delete {{ area.name }}?</p>
                      <button
                        type="button"
                        class="btn btn-destructive"
                        (click)="deleteArea(area)"
                        [attr.aria-busy]="notices.busyMap().has('delete-area') || null"
                        [disabled]="notices.busyMap().has('delete-area')"
                      >
                        Confirm delete {{ area.name }}
                      </button>
                      <button type="button" (click)="confirmDeleteAreaId.set(null)">Cancel</button>
                    }
                  }
                </li>
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
  private readonly planner = inject(PlannerDraftService);
  readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly canvas = viewChild(GardenPlanCanvas);
  gardenId = '';
  gardenName = signal('Garden');
  readonly draft = this.planner.draft;
  readonly loading = this.planner.loading;
  readonly flags = this.planner.flags;
  error = signal('');
  status = signal('');
  selectedId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  newBedName = '';
  newLength: number | null = 96;
  newWidth: number | null = 48;
  newAreaName = '';
  newAreaLength: number | null = 48;
  newAreaWidth: number | null = 48;
  confirmDeleteAreaId = signal<string | null>(null);

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
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

  selectBed(id: string) {
    if (!id) return;
    void this.router.navigate(['/gardens', this.gardenId, 'layout', 'beds', id]);
  }

  editGeometry(id: string) {
    this.selectedId.set(id);
  }

  zoomIn() {
    this.canvas()?.zoomIn();
  }

  zoomOut() {
    this.canvas()?.zoomOut();
  }

  toInt(value: string | number): number {
    const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
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
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) =>
        b.id === id && b.geometry ? { ...b, geometry: { ...b.geometry, ...patch } } : b,
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
        b.id === id && b.geometry ? { ...b, geometry: rotateBed90(b.geometry) } : b,
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
    await this.planner.load(this.gardenId, { reuseDirty: true });
    const detail = await this.gardensApi.detail(this.gardenId);
    if (detail) this.gardenName.set(detail.name);
  }

  async createBed() {
    const d = this.draft();
    if (!d) return;
    this.error.set('');
    this.status.set('');
    if (!this.guardMutate()) return;
    const name = this.newBedName.trim();
    const length = Math.trunc(Number(this.newLength));
    const width = Math.trunc(Number(this.newWidth));
    if (!name || length < 1 || width < 1) return;
    const id = crypto.randomUUID();
    const center = this.canvas()?.viewportCenterPlan() ?? { x: 0, y: 0 };
    const origin = originFromCenter(center.x, center.y, length, width);
    const geometry: BedGeometryDto = {
      originXInches: origin.originXInches,
      originYInches: origin.originYInches,
      lengthInches: length,
      widthInches: width,
      orientation: 0,
    };
    this.planner.newBedIds.add(id);
    this.planner.setDraft({
      ...d,
      beds: [...d.beds, { id, name, geometry }],
    });
    this.selectedId.set(id);
    this.newBedName = '';
    this.refreshFlags();
  }

  async createArea() {
    const d = this.draft();
    if (!d || !this.guardMutate()) return;
    const name = this.newAreaName.trim();
    const length = Math.trunc(Number(this.newAreaLength));
    const width = Math.trunc(Number(this.newAreaWidth));
    if (!name || length < 1 || width < 1) return;
    const id = crypto.randomUUID();
    const center = this.canvas()?.viewportCenterPlan() ?? { x: 0, y: 0 };
    const origin = originFromCenter(center.x, center.y, length, width);
    const area: LayoutAreaDto = {
      id,
      name,
      originXInches: origin.originXInches,
      originYInches: origin.originYInches,
      lengthInches: length,
      widthInches: width,
    };
    this.planner.setDraft({ ...d, areas: [...(d.areas ?? []), area] });
    this.newAreaName = '';
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
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) => (b.id === ev.bedId ? { ...b, geometry: ev.geometry } : b)),
    });
  }

  onAreaGeometry(ev: { area: LayoutAreaDto }) {
    if (!this.guardMutate()) return;
    const d = this.draft();
    if (!d) return;
    this.planner.setDraft({
      ...d,
      areas: (d.areas ?? []).map((a) => (a.id === ev.area.id ? ev.area : a)),
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
