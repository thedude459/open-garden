import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catalogDropOutcome } from '@open-garden/garden-layout';
import { applyPlantingDrop, type DropTarget } from '@open-garden/garden-layout/drop';
import { hitTestPlan } from '@open-garden/garden-layout/hit-test';
import { planToLocal } from '@open-garden/garden-layout/plan-coords';
import type { LayoutPlantingDto, PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { PlantingTray } from './planting-tray';
import { PlannerDraftService } from './planner-draft.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { OnlineRequiredError, GardensApiService } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { PlaceMarker } from '../ui/place-marker';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, GardenPlanCanvas, PlantingTray, PlaceMarker, EmptyState],
  template: `
    <p><a [routerLink]="['/gardens', gardenId, 'layout']">Back to overview</a></p>
    <og-place-marker [gardenId]="gardenId" [gardenName]="gardenName()" [current]="bed()?.name ?? 'Bed'" />
    <h2>Bed View</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (status()) {
      <p role="status">{{ status() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!draft() || !bed()) {
      <p class="muted">Bed unavailable or not found.</p>
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
      </div>
      <div class="planner-stage">
        <og-garden-plan-canvas
          [beds]="[bed()!]"
          [plantings]="draft()!.plantings"
          [canEdit]="canEdit()"
          [online]="online()"
          [allowBedGeometry]="false"
          [allowPlantingDrag]="true"
          [openBedOnClick]="false"
          [planLabel]="'Bed plan'"
          (plantingDrop)="onPlantingDrop($event)"
          (gestureEnd)="refreshFlags()"
          (missedBed)="onMissedBed()"
          (offlineRequired)="onOfflineRequired()"
          (planActivate)="onPlanActivate()"
          (planPointer)="onPlanPointer($event)"
        />
        <aside class="planner-rail">
          <h3>{{ bed()!.name }}</h3>
          @if (!inBed().length) {
            <og-empty-state title="This bed is empty" [body]="emptyPlantingBody()">
              @if (canEdit()) {
                <button type="button" class="btn btn-secondary" (click)="focusPlantPanel()">
                  Direct seed
                </button>
                <a class="btn btn-secondary" [routerLink]="['/gardens', gardenId, 'transplants']">
                  Transplants
                </a>
              }
            </og-empty-state>
          }
          <section id="plant-panel" class="plant-panel" aria-label="Plant panel">
            @if (canEdit()) {
              <form class="filters" (ngSubmit)="searchCatalog()">
                <input
                  #plantSearch
                  [(ngModel)]="searchQ"
                  name="plantSearch"
                  aria-label="Search plants"
                  placeholder="Search name / species / variety"
                />
                <select [(ngModel)]="zoneFilter" name="plantZone" aria-label="Zone">
                  <option [ngValue]="undefined">Any zone</option>
                  @for (z of zones; track z) {
                    <option [ngValue]="z">Zone {{ z }}</option>
                  }
                </select>
                <select [(ngModel)]="plantTypeFilter" name="plantType" aria-label="Type">
                  <option [ngValue]="undefined">Any type</option>
                  @for (t of types; track t) {
                    <option [ngValue]="t">{{ t }}</option>
                  }
                </select>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [attr.aria-busy]="notices.busyMap().has('search-catalog') || null"
                  [disabled]="notices.busyMap().has('search-catalog')"
                >
                  Apply
                </button>
              </form>
            }
            @if (searched() && catalogHits().length === 0 && canEdit()) {
              <og-empty-state title="No plants match" body="Try another name or clear filters." />
            }
            @if (catalogHits().length) {
              <ul class="card-list plant-panel-list">
                @for (p of catalogHits(); track p.id) {
                  <li class="row">
                    <span class="plant-stand-in" [attr.data-plant-type]="p.plantType">{{
                      p.plantType.slice(0, 1)
                    }}</span>
                    <span>
                      <strong>{{ p.commonName }}</strong>
                      <span class="muted"> · {{ p.plantType }}</span>
                      @if (zoneFilter !== undefined) {
                        <span class="muted"> · Fits zone {{ zoneFilter }}</span>
                      }
                    </span>
                    @if (canEdit()) {
                      <button
                        type="button"
                        [attr.aria-pressed]="armedPlant()?.id === p.id"
                        (pointerdown)="onArmPointerDown($event, p)"
                      >
                        Arm {{ p.commonName }}
                      </button>
                    }
                  </li>
                }
              </ul>
            }
          </section>
          <og-planting-tray
            [plantings]="trayPlantings()"
            [canEdit]="canEdit()"
            [online]="online()"
            (startDrag)="onTrayStart($event)"
            (offlineRequired)="onOfflineRequired()"
          />
          @if (inBed().length) {
            <h3>In this bed</h3>
            <ul class="card-list">
              @for (p of inBed(); track p.id) {
                <li class="row">
                  <span>{{ plantingLabel(p) }}</span>
                  @if (canEdit()) {
                    @if (confirmRemoveId() !== p.id) {
                      <button type="button" (click)="confirmRemoveId.set(p.id)">
                        Remove from bed {{ p.commonName }}
                      </button>
                    } @else {
                      <button type="button" (click)="removeFromBed(p)">
                        Confirm remove {{ p.commonName }}
                      </button>
                      <button type="button" (click)="confirmRemoveId.set(null)">Cancel</button>
                    }
                  }
                </li>
              }
            </ul>
          }
        </aside>
      </div>
    }
  `,
})
export class GardenBedViewPage implements OnInit {
  private readonly planner = inject(PlannerDraftService);
  private readonly plantsApi = inject(PlantsApiService);
  private readonly gardensApi = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);
  private readonly canvas = viewChild(GardenPlanCanvas);
  private readonly plantSearch = viewChild<ElementRef<HTMLInputElement>>('plantSearch');

  gardenId = '';
  bedId = '';
  gardenName = signal('Garden');
  readonly draft = this.planner.draft;
  readonly loading = this.planner.loading;
  readonly flags = this.planner.flags;
  error = signal('');
  status = signal('');
  online = signal(typeof navigator === 'undefined' || navigator.onLine);
  searchQ = '';
  zoneFilter: number | undefined;
  plantTypeFilter: PlantType | undefined;
  zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  types: PlantType[] = ['vegetable', 'herb', 'flower', 'fruit', 'shrub', 'tree'];
  catalogHits = signal<PlantSummaryDto[]>([]);
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
      if (el?.closest('[aria-label="Planting tray"]')) {
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
          target = bedId
            ? { kind: 'bed', bedId, planX: plan.x, planY: plan.y }
            : { kind: 'empty' };
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

  plantingLabel(p: LayoutPlantingDto) {
    return p.status === 'active' ? p.commonName : `${p.commonName} (removed from catalog)`;
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
    await this.planner.load(this.gardenId, { reuseDirty: true });
    const detail = await this.gardensApi.detail(this.gardenId);
    if (detail) {
      this.gardenName.set(detail.name);
      this.zoneFilter = detail.hardinessZone ?? undefined;
    }
  }

  focusPlantPanel() {
    this.plantSearch()?.nativeElement.focus();
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

  async searchCatalog() {
    await this.notices.run('search-catalog', async () => {
      const page = await this.plantsApi.list({
        q: this.searchQ.trim() || undefined,
        zone: this.zoneFilter,
        plantType: this.plantTypeFilter,
        page: 1,
        pageSize: 20,
      });
      this.catalogHits.set(page.items);
      this.searched.set(true);
    });
  }

  private tryCatalogPlace(clientX: number, clientY: number, plant: PlantSummaryDto) {
    const canvas = this.canvas();
    if (!canvas?.containsPoint(clientX, clientY)) {
      this.rejectCatalog('miss');
      return;
    }
    const plan = canvas.clientToPlan(clientX, clientY);
    this.placeCatalogAtPlan(plan.x, plan.y, plant);
  }

  private placeCatalogAtPlan(planX: number, planY: number, plant: PlantSummaryDto) {
    const d = this.draft();
    const bed = this.bed();
    if (!d || !bed?.geometry || !this.guardMutate()) return;
    const outcome = catalogDropOutcome(bed, d.plantings, planX, planY, plant.spacingInches);
    if (outcome !== 'ok') {
      this.rejectCatalog(outcome);
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

  private rejectCatalog(outcome: 'miss' | 'spacing' | 'fit') {
    this.armedPlant.set(null);
    if (outcome === 'miss') this.notices.miss('Drop missed a bed');
    else if (outcome === 'spacing') this.notices.error('Too close to another plant');
    else this.notices.error('Does not fit in this bed');
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
    this.planner.setDraft({
      ...d,
      plantings: applyPlantingDrop(d.plantings, d.beds, plantingId, before, target, this.bedId),
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
