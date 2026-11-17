import { HttpErrorResponse } from '@angular/common/http';
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
import { dropTargetAt } from '@open-garden/garden-layout/plan-drawing';
import { hitTestPlan } from '@open-garden/garden-layout/hit-test';
import { planToLocal } from '@open-garden/garden-layout/plan-coords';
import type { LayoutPlantingDto, PlantSummaryDto } from '@open-garden/shared-types';
import { ROOTSTOCK_LABELS, type Rootstock } from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { PlantingTray } from './planting-tray';
import { PlannerDraftService } from './planner-draft.service';
import { BedPlantPanel } from './bed-plant-panel';
import { BedPlantingsList } from './bed-plantings-list';
import { PlanSaveStatus } from './plan-save-status';
import { OnlineRequiredError, GardensApiService } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { AuthApiService } from '../auth/auth-api.service';
import { PlaceMarker } from '../ui/place-marker';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    GardenPlanCanvas,
    PlantingTray,
    PlaceMarker,
    BedPlantPanel,
    BedPlantingsList,
    PlanSaveStatus,
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
            <button type="button" class="btn btn-secondary" (click)="fit()">Fit</button>
            @if (canEdit()) {
              <og-plan-save-status />
            }
          </div>
        }
      </header>
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
            [planLabel]="
              armedPlant()
                ? 'Bed plan: press Enter to place ' + plantName(armedPlant()!) + ' in the middle'
                : 'Bed plan'
            "
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
              <og-bed-plant-panel
                [gardenId]="gardenId"
                [station]="bed()?.station"
                [canEdit]="canEdit()"
                [armedId]="armedPlant()?.id ?? null"
                [zone]="gardenZone()"
                [bedEmpty]="!inBed().length"
                [emptyBody]="emptyPlantingBody()"
                [(rootstock)]="rootstock"
                (armDown)="onArmPointerDown($event.event, $event.plant)"
                (armKey)="onArmKey($event)"
              />
            </section>
            <og-bed-plantings-list
              [plantings]="inBed()"
              [canEdit]="canEdit()"
              (remove)="removeFromBed($event)"
            />
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
  private readonly gardensApi = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  readonly units = inject(AuthApiService).units;
  private readonly route = inject(ActivatedRoute);
  private readonly canvas = viewChild(GardenPlanCanvas);

  gardenId = '';
  bedId = '';
  gardenName = signal('Garden');
  readonly draft = this.planner.draft;
  readonly loading = this.planner.loading;
  readonly flags = this.planner.flags;
  status = signal('');
  selectedPlantingId = signal<string | null>(null);
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  gardenZone = signal<number | undefined>(undefined);
  /** The rootstock a tree placed in this bed grows on; it sets the bed's size. */
  rootstock = signal<Rootstock>('semiDwarf');
  armedPlant = signal<PlantSummaryDto | null>(null);
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
        const target = dropTargetAt(hit, d.plantings, plan);
        if (target.kind === 'empty') this.onMissedBed();
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

  fit() {
    this.canvas()?.fit();
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
    await this.planner.syncWaitingTransplants();
    if (detail) {
      this.gardenName.set(detail.name);
      this.gardenZone.set(detail.hardinessZone ?? undefined);
    }
  }

  onArmPointerDown(ev: PointerEvent, plant: PlantSummaryDto) {
    if (!this.guardMutate()) return;
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault();
    // Capture so drag-from-Place reaches the bed (same pattern as waiting transplants).
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.panelDrag = { plant, x: ev.clientX, y: ev.clientY };
  }

  /** Place from the keyboard: choose the plant, then Enter on the plan puts it in the middle. */
  onArmKey(plant: PlantSummaryDto) {
    if (!this.guardMutate()) return;
    this.armedPlant.set(plant);
    this.canvas()?.focusPlan();
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
    this.planner.edit({ ...d, plantings: [planting, ...d.plantings] });
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
    const spacing = treeSpacingInches(plant, this.rootstock());
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
      rootstock: ROOTSTOCK_LABELS[this.rootstock()],
      life: 'tree',
      startMethod: 'direct_seed',
      indoorStartedOn: null,
      placement: { plantingId: id, bedId: bed.id, xInches: size / 2, yInches: size / 2 },
    };
    this.planner.edit({
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

  async removeFromBed(planting: LayoutPlantingDto) {
    if (!this.guardMutate()) return;
    if (planting.startMethod === 'direct_seed' && this.planner.isSavedPlanting(planting.id)) {
      // A confirmed delete happens now; Undo does not bring it back.
      try {
        await this.planner.deletePlantingNow(planting.id);
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    } else if (planting.startMethod === 'direct_seed') {
      const d = this.draft();
      if (!d) return;
      this.planner.edit({ ...d, plantings: d.plantings.filter((p) => p.id !== planting.id) });
    } else {
      this.applyDrop(planting.id, planting, { kind: 'tray' });
    }
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
    this.planner.edit({
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
