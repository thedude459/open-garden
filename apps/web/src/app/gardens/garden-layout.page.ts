import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  originFromCenter,
  drawableBeds,
  clampSizeToPlot,
  clampOriginToPlot,
  bedPlanSize,
} from '@open-garden/garden-layout';
import { rotateBed90 } from '@open-garden/garden-layout/rotate';
import type {
  BedGeometryDto,
  GardenLayoutDto,
  BedSite,
  LayoutAreaDto,
  LayoutBedDto,
  PropertyAreaDto,
  TrayDto,
} from '@open-garden/shared-types';
import { mulchOrNone } from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import {
  LayoutNewBedForm,
  LayoutNewWalkwayForm,
  type NewBed,
  type NewPlot,
} from './layout-add-forms';
import { LayoutBedInspector, type BedSettingsPatch } from './layout-bed-inspector';
import { LayoutBedsList, LayoutWalkwaysList } from './layout-lists';
import { PlanSaveStatus } from './plan-save-status';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { PlantingsApiService } from './plantings-api.service';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { PlaceMarker } from '../ui/place-marker';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    GardenPlanCanvas,
    PlaceMarker,
    EmptyState,
    LayoutNewBedForm,
    LayoutNewWalkwayForm,
    LayoutBedInspector,
    LayoutBedsList,
    LayoutWalkwaysList,
    PlanSaveStatus,
  ],
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
              <og-plan-save-status />
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
              <og-layout-new-bed
                [note]="draft()!.beds.length ? '' : emptyBedBody()"
                [canCancel]="draft()!.beds.length > 0"
                (create)="createBed($event)"
                (cancelled)="adding.set(null)"
              />
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
              <og-layout-new-walkway (create)="createArea($event)" (cancelled)="adding.set(null)" />
            } @else if (canEdit() && selectedBed(); as bed) {
              <og-layout-bed-inspector
                [bed]="bed"
                [saved]="isSaved(bed)"
                [deleting]="notices.busyMap().has('delete-bed')"
                (settings)="saveBedSettings(bed, $event)"
                (geometryChange)="patchSelected($event)"
                (rotate)="rotateSelected()"
                (remove)="deleteBed(bed)"
                (done)="selectedId.set(null)"
                (saveLayout)="planner.flush()"
              />
            }
            @if (!draft()!.beds.length && !canEdit()) {
              <og-empty-state title="No beds yet" [body]="emptyBedBody()" />
            }
            <og-layout-beds-list
              [beds]="sizedBeds()"
              [selectedId]="selectedId()"
              [canEdit]="canEdit()"
              (open)="openBed($event)"
              (edit)="editGeometry($event)"
            />
            <og-layout-walkways-list
              [areas]="draft()!.areas"
              [canEdit]="canEdit()"
              [deleting]="notices.busyMap().has('delete-area')"
              (remove)="deleteArea($event)"
            />
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
  readonly planner = inject(PlannerDraftService);
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
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  trayName = '';
  readonly areas = signal<PropertyAreaDto[]>([]);
  /** False until the first areas request settles, so "Add vegetable garden" cannot duplicate one not yet shown. */
  readonly areasLoaded = signal(false);
  readonly trays = signal<TrayDto[]>([]);
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

  sizedBeds() {
    return drawableBeds(this.draft()?.beds ?? []);
  }

  openBed(id: string) {
    if (!id) return;
    void this.router.navigate(['/gardens', this.gardenId, 'layout', 'beds', id]);
  }

  editGeometry(id: string) {
    this.adding.set(null);
    this.selectedId.set(id);
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
    return this.planner.isSavedBed(bed.id);
  }

  async saveBedSettings(bed: LayoutBedDto, patch: BedSettingsPatch) {
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
    this.planner.edit({
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
    this.planner.edit({
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

  /** A tree bed (8 × 8 ft), or a row of canes in a bramble patch (10 × 3 ft). */
  addStation(station: 'tree' | 'berry') {
    this.addMenuOpen.set(false);
    const tree = station === 'tree';
    this.createBed({
      name: tree ? 'Tree' : 'Canes',
      lengthInches: tree ? 96 : 120,
      widthInches: tree ? 96 : 36,
      site: 'in_ground',
      mulch: 'none',
      station,
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

  createBed(bed: NewBed & { station?: 'tree' | 'berry' }) {
    const d = this.draft();
    if (!d) return;
    this.error.set('');
    this.status.set('');
    if (!this.guardMutate()) return;
    const { name, lengthInches: length, widthInches: width, site, mulch, station } = bed;
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
    this.planner.edit({
      ...d,
      beds: [
        ...d.beds,
        {
          id,
          name,
          geometry,
          site,
          mulch,
          ...(station ? { station } : {}),
        },
      ],
    });
    this.adding.set(null);
    this.editGeometry(id);
    this.refreshFlags();
  }

  createArea(plot: NewPlot) {
    const d = this.draft();
    if (!d || !this.guardMutate()) return;
    const { name, lengthInches: length, widthInches: width } = plot;
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
    this.planner.edit({ ...d, areas: [...(d.areas ?? []), placed] });
    this.adding.set(null);
  }

  async deleteArea(area: LayoutAreaDto) {
    this.error.set('');
    if (!this.guardMutate()) return;
    const d = this.draft();
    if (!d) return;
    const inSaved = this.planner.isSavedArea(area.id);
    const without = (l: GardenLayoutDto) => ({
      ...l,
      areas: (l.areas ?? []).filter((a) => a.id !== area.id),
    });
    if (!inSaved) {
      this.planner.edit(without(d));
      return;
    }
    await this.notices.run('delete-area', async () => {
      try {
        await this.planner.flush();
        await this.api.deleteArea(this.gardenId, area.id);
        this.planner.applyServerDelete(without);
      } catch (err) {
        this.fail(err);
      }
    });
  }

  async deleteBed(bed: LayoutBedDto) {
    this.error.set('');
    if (!this.guardMutate()) return;
    if (!this.planner.isSavedBed(bed.id)) {
      const d = this.draft();
      if (d) this.planner.edit(withoutBed(d, bed.id));
      return;
    }
    await this.notices.run('delete-bed', async () => {
      try {
        await this.planner.flush();
        await this.api.deleteBed(this.gardenId, bed.id);
        this.planner.applyServerDelete((l) => withoutBed(l, bed.id));
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
    this.planner.edit({
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
    this.planner.edit({
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

/**
 * A layout without a bed, as deleting it leaves things: plants sown in it go
 * with it, and transplants in it go back to waiting.
 */
function withoutBed(layout: GardenLayoutDto, bedId: string): GardenLayoutDto {
  const inBed = (p: GardenLayoutDto['plantings'][number]) =>
    p.bedId === bedId || p.placement?.bedId === bedId;
  return {
    ...layout,
    beds: layout.beds.filter((b) => b.id !== bedId),
    plantings: layout.plantings
      .filter((p) => !(p.startMethod === 'direct_seed' && inBed(p)))
      .map((p) => (inBed(p) ? { ...p, bedId: null, placement: null } : p)),
  };
}
