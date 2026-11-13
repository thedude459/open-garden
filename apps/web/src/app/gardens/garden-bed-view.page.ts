import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { plantName } from '@open-garden/shared-types';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catalogDropOutcome,
  fitsInBed,
  formatLength,
  formatSpacing,
  plantingDropOutcome,
  remainingGridCount,
  sizeTreeBed,
  treeSpacingInches,
} from '@open-garden/garden-layout';
import { applyPlantingDrop, type DropTarget } from '@open-garden/garden-layout/drop';
import { hitTestPlan } from '@open-garden/garden-layout/hit-test';
import { planToLocal } from '@open-garden/garden-layout/plan-coords';
import type {
  FavoriteListItemDto,
  LayoutPlantingDto,
  PlantSummaryDto,
} from '@open-garden/shared-types';
import {
  allowsPlant,
  areaKindFor,
  ROOTSTOCK_LABELS,
  ROOTSTOCKS,
  type Rootstock,
} from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { PlantingTray } from './planting-tray';
import { PlannerDraftService } from './planner-draft.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantPicker } from '../plants/plant-picker';
import { OnlineRequiredError, GardensApiService } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { AuthApiService } from '../auth/auth-api.service';
import { PlaceMarker } from '../ui/place-marker';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    GardenPlanCanvas,
    PlantingTray,
    PlaceMarker,
    EmptyState,
    PlantPicker,
  ],
  template: `
    <p class="back-link"><a [routerLink]="['/gardens', gardenId, 'layout']">Back to overview</a></p>
    <div class="planner">
      <header class="page-head">
        <div>
          <og-place-marker
            [gardenId]="gardenId"
            [gardenName]="gardenName()"
            [current]="bed()?.name ?? 'Bed'"
          />
          <h2>Bed View</h2>
        </div>
        @if (!loading() && draft() && bed()) {
          <div class="planner-toolbar">
            <button type="button" class="btn btn-secondary" (click)="zoomIn()">Zoom in</button>
            <button type="button" class="btn btn-secondary" (click)="zoomOut()">Zoom out</button>
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
          </div>
        }
      </header>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (status()) {
        <p role="status">{{ status() }}</p>
      }
      @if (selectedPlantingName()) {
        <p role="status">{{ selectedPlantingName() }}</p>
      }
      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else if (!draft() || !bed()) {
        <p class="muted">Bed unavailable or not found.</p>
      } @else {
        <div class="planner-alerts">
          @if (armedPlant(); as picked) {
            <p class="place-hint" role="status">
              @if (slotsLeft(picked) === 0) {
                No room left for {{ plantName(picked) }} ({{ spacing(picked.spacingInches) }}).
              } @else {
                Click the bed to place {{ plantName(picked) }}. About {{ slotsLeft(picked) }} more
                fit at {{ spacing(picked.spacingInches) }}.
              }
            </p>
          }
          @if (dirty()) {
            <p role="status">Unsaved changes</p>
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
            [beds]="[bed()!]"
            [plantings]="draft()!.plantings"
            [priorCrops]="draft()!.priorCrops ?? []"
            [canEdit]="canEdit()"
            [online]="online()"
            [allowBedGeometry]="false"
            [allowPlantingDrag]="true"
            [showPlantingMarks]="true"
            [showBedCaption]="false"
            [probeSpacing]="armedPlant()?.spacingInches ?? null"
            [planLabel]="'Bed plan'"
            (plantingDrop)="onPlantingDrop($event)"
            (gestureEnd)="refreshFlags()"
            (missedBed)="onMissedBed()"
            (offlineRequired)="onOfflineRequired()"
            (planActivate)="onPlanActivate()"
            (planPointer)="onPlanPointer($event)"
            (selectPlanting)="onSelectPlanting($event)"
          />
          <aside class="planner-rail bed-rail">
            <section id="plant-panel" class="plant-panel" aria-label="Plant panel">
              @if (canEdit()) {
                <h3>Add a plant</h3>
                @if (bed()?.station === 'tree') {
                  <label>
                    Rootstock
                    <select name="rootstock" [(ngModel)]="rootstock">
                      @for (r of rootstocks; track r) {
                        <option [value]="r">{{ rootstockLabels[r] }}</option>
                      }
                    </select>
                  </label>
                  <p class="muted">The tree's bed takes its spacing on this rootstock.</p>
                }
                @if (!armedPlant()) {
                  <p class="muted">Choose Place, then click the bed. Or drag the plant onto it.</p>
                }
                @if (!inBed().length) {
                  <div class="empty-actions">
                    <button type="button" class="btn btn-secondary" (click)="focusPlantPanel()">
                      Direct seed
                    </button>
                    <a
                      class="btn btn-secondary"
                      [routerLink]="['/gardens', gardenId, 'transplants']"
                    >
                      Transplants
                    </a>
                  </div>
                }
                @if (favorites().length) {
                  <h3>Favorites</h3>
                  <ul class="card-list">
                    @for (f of shownFavorites(); track f.favoriteId) {
                      @if (!f.unavailable) {
                        @if (catalogPlant(f.plant); as p) {
                          <li class="row">
                            <span>
                              <strong>{{ plantName(p) }}</strong>
                              <span class="muted"> · {{ p.plantType }}</span>
                            </span>
                            <button
                              type="button"
                              class="btn btn-primary"
                              [attr.aria-label]="'Place ' + plantName(p)"
                              [attr.aria-pressed]="armedPlant()?.id === p.id"
                              (pointerdown)="onArmPointerDown($event, p)"
                            >
                              Place
                            </button>
                          </li>
                        }
                      }
                    }
                  </ul>
                }
                <og-plant-picker
                  [filters]="true"
                  [live]="true"
                  [zone]="gardenZone()"
                  (results)="onCatalog($event)"
                  (searched)="searched.set(true)"
                  (zoneChange)="activeZone.set($event)"
                  (failed)="onSearchFailed($event)"
                />
              } @else if (!inBed().length) {
                <og-empty-state title="This bed is empty" [body]="emptyPlantingBody()" />
              }
              @if (searched() && catalogHits().length === 0 && canEdit()) {
                <og-empty-state title="No plants match" body="Try another name or clear filters." />
              }
              @if (catalogHits().length) {
                <ul class="card-list plant-panel-list">
                  @for (p of catalogHits(); track p.id) {
                    <li class="row">
                      @if (p.illustrationUrl) {
                        <img
                          [src]="p.illustrationUrl"
                          alt=""
                          width="32"
                          height="32"
                          decoding="async"
                        />
                      } @else {
                        <span class="plant-stand-in" [attr.data-plant-type]="p.plantType">{{
                          p.plantType.slice(0, 1)
                        }}</span>
                      }
                      <span>
                        <strong>{{ plantName(p) }}</strong>
                        <span class="muted"> · {{ p.plantType }}</span>
                        @if (activeZone() !== undefined) {
                          <span class="muted"> · Fits zone {{ activeZone() }}</span>
                        }
                      </span>
                      @if (canEdit()) {
                        <button
                          type="button"
                          class="btn btn-primary"
                          [attr.aria-label]="'Place ' + plantName(p)"
                          [attr.aria-pressed]="armedPlant()?.id === p.id"
                          (pointerdown)="onArmPointerDown($event, p)"
                        >
                          Place
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
            </section>
            @if (inBed().length) {
              <h3>In this bed</h3>
              <ul class="card-list">
                @for (p of inBed(); track p.id) {
                  <li class="row">
                    <span>{{ plantingLabel(p) }}</span>
                    @if (canEdit()) {
                      @if (confirmRemoveId() !== p.id) {
                        <button
                          type="button"
                          class="btn btn-secondary"
                          [attr.aria-label]="'Remove from bed ' + plantName(p)"
                          (click)="confirmRemoveId.set(p.id)"
                        >
                          Remove
                        </button>
                      } @else {
                        <span class="member-actions">
                          <button
                            type="button"
                            class="btn btn-primary"
                            [attr.aria-label]="'Confirm remove ' + plantName(p)"
                            (click)="removeFromBed(p)"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            (click)="confirmRemoveId.set(null)"
                          >
                            Cancel
                          </button>
                        </span>
                      }
                    }
                  </li>
                }
              </ul>
            }
            <og-planting-tray
              [plantings]="trayPlantings()"
              [canEdit]="canEdit()"
              [online]="online()"
              (startDrag)="onTrayStart($event)"
              (offlineRequired)="onOfflineRequired()"
            />
          </aside>
        </div>
      }
    </div>
  `,
})
export class GardenBedViewPage implements OnInit {
  readonly plantName = plantName;
  private readonly planner = inject(PlannerDraftService);
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly gardensApi = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  readonly units = inject(AuthApiService).units;
  private readonly route = inject(ActivatedRoute);
  private readonly canvas = viewChild(GardenPlanCanvas);
  private readonly picker = viewChild(PlantPicker);

  gardenId = '';
  bedId = '';
  gardenName = signal('Garden');
  readonly draft = this.planner.draft;
  readonly loading = this.planner.loading;
  readonly flags = this.planner.flags;
  error = signal('');
  status = signal('');
  selectedPlantingId = signal<string | null>(null);
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  gardenZone = signal<number | undefined>(undefined);
  activeZone = signal<number | undefined>(undefined);
  catalogHits = signal<PlantSummaryDto[]>([]);
  favorites = signal<FavoriteListItemDto[]>([]);
  /** The rootstock a tree placed in this bed grows on; it sets the bed's size. */
  rootstock: Rootstock = 'semiDwarf';
  readonly rootstocks = ROOTSTOCKS;
  readonly rootstockLabels = ROOTSTOCK_LABELS;
  searched = signal(false);
  armedPlant = signal<PlantSummaryDto | null>(null);
  confirmRemoveId = signal<string | null>(null);
  private trayDrag: { plantingId: string; before: LayoutPlantingDto } | null = null;
  private panelDrag: { plant: PlantSummaryDto; x: number; y: number } | null = null;

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    this.bedId = this.route.snapshot.paramMap.get('bedId') ?? '';
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

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(ev: PointerEvent) {
    const panel = this.panelDrag;
    if (panel) {
      this.panelDrag = null;
      const moved = Math.hypot(ev.clientX - panel.x, ev.clientY - panel.y) >= 8;
      if (!moved) {
        this.armedPlant.set(panel.plant);
        return;
      }
      this.tryCatalogPlace(ev.clientX, ev.clientY, panel.plant);
      return;
    }
    const drag = this.trayDrag;
    if (drag) {
      this.trayDrag = null;
      const d = this.draft();
      if (!d) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (el?.closest('.unplaced-tray')) {
        this.applyDrop(drag.plantingId, drag.before, { kind: 'tray' });
        return;
      }
      const canvas = this.canvas();
      if (canvas?.containsPoint(ev.clientX, ev.clientY)) {
        const plan = canvas.clientToPlan(ev.clientX, ev.clientY);
        const hit = hitTestPlan([this.bed()!].filter(Boolean), d.plantings, plan.x, plan.y, 8);
        let target: DropTarget;
        if (hit.kind === 'empty') {
          target = { kind: 'empty' };
          this.onMissedBed();
        } else if (hit.kind === 'bed' || hit.kind === 'bed-handle') {
          target = { kind: 'bed', bedId: hit.bedId, planX: plan.x, planY: plan.y };
        } else if (hit.kind === 'planting') {
          const bedId = d.plantings.find((p) => p.id === hit.plantingId)?.placement?.bedId;
          target = bedId ? { kind: 'bed', bedId, planX: plan.x, planY: plan.y } : { kind: 'empty' };
          if (target.kind === 'empty') this.onMissedBed();
        } else {
          target = { kind: 'empty' };
          this.onMissedBed();
        }
        this.applyDrop(drag.plantingId, drag.before, target);
        return;
      }
      this.applyDrop(drag.plantingId, drag.before, { kind: 'empty' });
      this.onMissedBed();
    }
  }

  bed() {
    return this.draft()?.beds.find((b) => b.id === this.bedId) ?? null;
  }

  canEdit() {
    const role = this.draft()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  dirty() {
    return this.planner.dirty();
  }

  trayPlantings() {
    return (
      this.draft()?.plantings.filter(
        (p) => p.startMethod === 'transplant' && p.placement === null,
      ) ?? []
    );
  }

  inBed() {
    return this.draft()?.plantings.filter((p) => p.placement?.bedId === this.bedId) ?? [];
  }

  slotsLeft(plant: PlantSummaryDto): number {
    const geo = this.bed()?.geometry;
    if (!geo) return 0;
    return remainingGridCount(
      geo.lengthInches,
      geo.widthInches,
      plant.spacingInches,
      this.inBed().flatMap((planting) =>
        planting.placement
          ? [
              {
                xInches: planting.placement.xInches,
                yInches: planting.placement.yInches,
                spacingInches: planting.spacingInches,
              },
            ]
          : [],
      ),
    );
  }

  plantingLabel(p: LayoutPlantingDto) {
    return p.status === 'active' ? plantName(p) : `${plantName(p)} (removed from catalog)`;
  }

  selectedPlantingName() {
    const id = this.selectedPlantingId();
    if (!id) return '';
    const planting = this.draft()?.plantings.find((p) => p.id === id);
    return planting ? plantName(planting) : '';
  }

  onSelectPlanting(id: string | null) {
    this.selectedPlantingId.set(id);
  }

  zoomIn() {
    this.canvas()?.zoomIn();
  }

  zoomOut() {
    this.canvas()?.zoomOut();
  }

  emptyPlantingBody() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return new OnlineRequiredError().message;
    }
    return this.canEdit()
      ? 'Direct seed in this bed or add transplants, then place them here.'
      : 'Nothing is planted in this bed yet.';
  }

  async load() {
    const [, detail] = await Promise.all([
      this.planner.load(this.gardenId, { reuseDirty: true }),
      this.gardensApi.detail(this.gardenId),
    ]);
    if (detail) {
      this.gardenName.set(detail.name);
      this.gardenZone.set(detail.hardinessZone ?? undefined);
    }
    if (this.canEdit()) {
      void this.favoritesApi
        .list()
        .then((page) => this.favorites.set(page.items))
        .catch(() => undefined);
    }
  }

  focusPlantPanel() {
    this.picker()?.focus();
  }

  onCatalog(items: PlantSummaryDto[]) {
    this.catalogHits.set(
      items.filter((plant) => allowsPlant(areaKindFor(this.bed()?.station), plant.plantType)),
    );
  }

  shownFavorites() {
    return this.favorites().filter((favorite) => {
      const plant = this.catalogPlant(favorite.plant);
      return plant ? allowsPlant(areaKindFor(this.bed()?.station), plant.plantType) : false;
    });
  }

  onSearchFailed(err: unknown) {
    this.catalogHits.set([]);
    this.error.set(messageFrom(err));
  }

  catalogPlant(plant: FavoriteListItemDto['plant']): PlantSummaryDto | null {
    const spacingInches = plant.spacingInches;
    if (spacingInches == null) return null;
    return { ...plant, spacingInches };
  }

  onArmPointerDown(ev: PointerEvent, plant: PlantSummaryDto) {
    if (!this.guardMutate()) return;
    ev.preventDefault();
    this.panelDrag = { plant, x: ev.clientX, y: ev.clientY };
  }

  onPlanActivate() {
    const plant = this.armedPlant();
    const canvas = this.canvas();
    if (!plant || !canvas) return;
    const center = canvas.viewportCenterPlan();
    this.placeCatalogAtPlan(center.x, center.y, plant);
  }

  onPlanPointer(ev: { clientX: number; clientY: number }) {
    const plant = this.armedPlant();
    if (!plant) return;
    this.tryCatalogPlace(ev.clientX, ev.clientY, plant);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.armedPlant.set(null);
  }

  private tryCatalogPlace(clientX: number, clientY: number, plant: PlantSummaryDto) {
    const canvas = this.canvas();
    if (!canvas?.containsPoint(clientX, clientY)) {
      this.rejectCatalog('miss', plant.spacingInches);
      return;
    }
    const plan = canvas.clientToPlan(clientX, clientY);
    this.placeCatalogAtPlan(plan.x, plan.y, plant);
  }

  private placeCatalogAtPlan(planX: number, planY: number, plant: PlantSummaryDto) {
    const d = this.draft();
    const bed = this.bed();
    if (!d || !bed?.geometry || !this.guardMutate()) return;
    if (plant.plantType === 'tree' && bed.station === 'tree') {
      this.placeTree(plant);
      return;
    }
    const outcome = catalogDropOutcome(bed, d.plantings, planX, planY, plant.spacingInches);
    if (outcome !== 'ok') {
      this.rejectCatalog(outcome, plant.spacingInches);
      return;
    }
    const local = planToLocal(bed.geometry, planX, planY);
    const id = crypto.randomUUID();
    const planting: LayoutPlantingDto = {
      id,
      plantId: plant.id,
      commonName: plant.commonName,
      species: plant.species,
      cultivar: plant.cultivar,
      plantType: plant.plantType,
      family: plant.family ?? null,
      status: 'active',
      bedId: bed.id,
      spacingInches: plant.spacingInches,
      startMethod: 'direct_seed',
      indoorStartedOn: null,
      placement: {
        plantingId: id,
        bedId: bed.id,
        xInches: local.x,
        yInches: local.y,
      },
    };
    this.planner.newDirectSeedIds.add(id);
    this.planner.setDraft({ ...d, plantings: [planting, ...d.plantings] });
    this.armedPlant.set(null);
    this.refreshFlags();
  }

  /**
   * A tree goes in the middle of its bed, and the bed takes the tree's
   * spacing on the chosen rootstock. Underplanting keeps its place.
   */
  private placeTree(plant: PlantSummaryDto) {
    const d = this.draft();
    const bed = this.bed();
    if (!d || !bed?.geometry) return;
    if (d.plantings.some((p) => p.bedId === bed.id && p.plantType === 'tree')) {
      this.armedPlant.set(null);
      this.notices.error('A tree bed holds one tree');
      return;
    }
    const spacing = treeSpacingInches(plant, this.rootstock);
    if (spacing === null) return;
    const sized = sizeTreeBed(bed.geometry, spacing);
    const id = crypto.randomUUID();
    const size = sized.geometry.lengthInches;
    const tree: LayoutPlantingDto = {
      id,
      plantId: plant.id,
      commonName: plant.commonName,
      species: plant.species,
      cultivar: plant.cultivar,
      plantType: plant.plantType,
      family: plant.family ?? null,
      status: 'active',
      bedId: bed.id,
      spacingInches: sized.spacingFeet * 12,
      spacingFeet: sized.spacingFeet,
      rootstock: ROOTSTOCK_LABELS[this.rootstock],
      life: 'tree',
      startMethod: 'direct_seed',
      indoorStartedOn: null,
      placement: { plantingId: id, bedId: bed.id, xInches: size / 2, yInches: size / 2 },
    };
    this.planner.newDirectSeedIds.add(id);
    this.planner.setDraft({
      ...d,
      beds: d.beds.map((b) => (b.id === bed.id ? { ...b, geometry: sized.geometry } : b)),
      plantings: [
        tree,
        ...d.plantings.map((p) =>
          p.placement?.bedId === bed.id
            ? {
                ...p,
                placement: {
                  ...p.placement,
                  xInches: p.placement.xInches + sized.shiftX,
                  yInches: p.placement.yInches + sized.shiftY,
                },
              }
            : p,
        ),
      ],
    });
    this.armedPlant.set(null);
    this.refreshFlags();
  }

  private rejectCatalog(outcome: 'miss' | 'spacing' | 'fit', spacingInches: number | null) {
    this.armedPlant.set(null);
    if (outcome === 'miss') this.notices.miss('Place it inside the bed');
    else if (outcome === 'spacing') this.notices.error('Too close to another plant');
    else this.notices.error(this.fitMessage(spacingInches));
  }

  /** A plant too big for the whole bed, or one placed too near its edge. */
  spacing(inches: number | null | undefined): string {
    return inches == null ? '' : formatSpacing(inches, this.units());
  }

  private fitMessage(spacingInches: number | null): string {
    const geo = this.bed()?.geometry;
    if (
      geo &&
      spacingInches !== null &&
      !fitsInBed(geo.lengthInches, geo.widthInches, spacingInches)
    ) {
      return `Too big for this bed: needs ${formatLength(spacingInches, this.units())} of space`;
    }
    return 'Too close to the bed edge. Move it further in';
  }

  removeFromBed(planting: LayoutPlantingDto) {
    if (!this.guardMutate()) return;
    if (planting.startMethod === 'direct_seed') {
      const d = this.draft();
      if (!d) return;
      if (this.planner.newDirectSeedIds.has(planting.id)) {
        this.planner.newDirectSeedIds.delete(planting.id);
      } else {
        this.planner.pendingDirectSeedDeletes.add(planting.id);
      }
      this.planner.setDraft({
        ...d,
        plantings: d.plantings.filter((p) => p.id !== planting.id),
      });
    } else {
      this.applyDrop(planting.id, planting, { kind: 'tray' });
    }
    this.confirmRemoveId.set(null);
    this.refreshFlags();
  }

  onTrayStart(ev: { plantingId: string }) {
    const d = this.draft();
    const before = d?.plantings.find((p) => p.id === ev.plantingId);
    if (!before || !this.guardMutate()) return;
    this.trayDrag = { plantingId: before.id, before };
  }

  onPlantingDrop(ev: { plantingId: string; before: LayoutPlantingDto; target: DropTarget }) {
    if (!this.guardMutate()) return;
    this.applyDrop(ev.plantingId, ev.before, ev.target);
  }

  onMissedBed() {
    this.notices.miss('Drop missed a bed');
  }

  onOfflineRequired() {
    this.notices.error(new OnlineRequiredError().message);
  }

  refreshFlags() {
    this.planner.refreshFlags();
  }

  async save() {
    await this.notices.run('save-layout', async () => {
      if (!this.guardMutate()) return;
      this.error.set('');
      this.planner.refreshFlags();
      try {
        await this.planner.save();
        this.notices.success('Layout saved');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  private applyDrop(plantingId: string, before: LayoutPlantingDto, target: DropTarget) {
    const d = this.draft();
    if (!d) return;
    const plantings = applyPlantingDrop(
      d.plantings,
      d.beds,
      plantingId,
      before,
      target,
      this.bedId,
    );
    if (target.kind === 'bed') {
      const outcome = plantingDropOutcome(d.beds, plantings, plantingId);
      if (outcome !== 'ok') {
        this.rejectCatalog(outcome, before.spacingInches);
        return;
      }
    }
    this.planner.setDraft({
      ...d,
      plantings,
    });
    this.refreshFlags();
  }

  private guardMutate(): boolean {
    if (!this.canEdit()) return false;
    if (!this.online() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      this.onOfflineRequired();
      return false;
    }
    return true;
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: { message?: string } } | undefined;
    return body?.error?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
