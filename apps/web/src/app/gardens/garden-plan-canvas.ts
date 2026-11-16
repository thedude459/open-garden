import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { plantName } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import {
  originFromGrabOffset,
  shortenPlantingMarkName,
  catalogDropOutcome,
  formatPlanSize,
  snapHalfFoot,
  formatPlanFrame,
  frameAround,
  rectsFit,
  clampSizeToPlot,
  clampOriginToPlot,
  rectAtPlotEdge,
  type PlanFrame,
  fitView,
  visibleArea,
  zoomAbout,
  MIN_PLAN_SCALE,
  MAX_PLAN_SCALE,
  type PlanView,
  pairRequiredSpacing,
} from '@open-garden/garden-layout';
import { classifyGesture, hitTestPlan, isClickNotDrag } from '@open-garden/garden-layout/hit-test';
import { plantingFootprintRadius } from '@open-garden/garden-layout/footprint';
import { drawableBeds } from '@open-garden/garden-layout/drawable-beds';
import { overviewPlantingLabels } from '@open-garden/garden-layout/overview-labels';
import { bedPlanSize, localToPlan } from '@open-garden/garden-layout/rotate';
import type { DropTarget } from '@open-garden/garden-layout/drop';
import {
  bedAt,
  bedGridLines,
  contentRects,
  dropTargetAt,
  marginBands,
  soilSize,
  type PlanBox,
} from '@open-garden/garden-layout/plan-drawing';
import type {
  BedGeometryDto,
  LayoutAreaDto,
  LayoutBedDto,
  LayoutPlantingDto,
  PriorCropDto,
} from '@open-garden/shared-types';

const HANDLE_INCHES = 8;
const NO_PLANTINGS: LayoutPlantingDto[] = [];
const NO_NAMES: Array<{ name: string; count: number }> = [];

type Gesture =
  | { type: 'pan'; lastX: number; lastY: number }
  /** Catalog/transplant is armed: pointerup places, pan is deferred until Escape. */
  | { type: 'place-catalog' }
  | {
      type: 'move-planting';
      plantingId: string;
      before: LayoutPlantingDto;
    }
  | {
      type: 'move-bed';
      bedId: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      type: 'resize-bed';
      bedId: string;
      startX: number;
      startY: number;
      length: number;
      width: number;
      planWidth: number;
      planHeight: number;
    }
  | {
      type: 'move-area';
      areaId: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      type: 'resize-area';
      areaId: string;
      startX: number;
      startY: number;
      length: number;
      width: number;
    }
  | { type: 'pinch'; startDist: number; startScale: number };

@Component({
  standalone: true,
  selector: 'og-garden-plan-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="plan-viewport"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (pointerleave)="probePoint.set(null)"
    >
      <svg
        #planSvg
        class="layout-plan"
        [class.can-move-beds]="canEdit() && allowBedGeometry()"
        preserveAspectRatio="xMidYMid meet"
        [attr.viewBox]="viewBox()"
        aria-label="{{ planLabel() }}"
        [attr.tabindex]="allowPlantingDrag() ? 0 : null"
        (keydown)="onPlanKey($event)"
        [style.transform]="cssTransform()"
      >
        <defs>
          <pattern id="og-area-hatch" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M0 8 L8 0" stroke="#4a4a4a" stroke-width="1.2" fill="none" />
          </pattern>
        </defs>
        @if (allowBedGeometry()) {
          <rect
            class="plot-boundary"
            [attr.x]="plot().x"
            [attr.y]="plot().y"
            [attr.width]="plot().w"
            [attr.height]="plot().h"
            aria-hidden="true"
          />
        }
        @for (bed of drawnBeds(); track bed.id) {
          @if (geometryOf(bed); as geo) {
            <rect
              [attr.x]="geo.originXInches"
              [attr.y]="geo.originYInches"
              [attr.width]="planSize(geo).width"
              [attr.height]="planSize(geo).height"
              class="layout-bed-frame"
              [class.selected]="selectedId() === bed.id"
              [attr.data-bed-id]="bed.id"
              [attr.data-bed-name]="bed.name"
              [attr.data-kind]="'bed'"
              tabindex="0"
              [attr.aria-label]="bed.name"
            />
            <rect
              class="layout-bed"
              [class.selected]="selectedId() === bed.id"
              [attr.x]="geo.originXInches + 3"
              [attr.y]="geo.originYInches + 3"
              [attr.width]="soilSize(geo).width"
              [attr.height]="soilSize(geo).height"
            />
            @if (allowPlantingDrag()) {
              @for (line of gridLines(geo); track $index) {
                <line
                  [attr.x1]="line.x1"
                  [attr.y1]="line.y1"
                  [attr.x2]="line.x2"
                  [attr.y2]="line.y2"
                  class="layout-grid"
                />
              }
            }
            @if (showBedCaption()) {
              <text
                [attr.x]="geo.originXInches + planSize(geo).width / 2"
                [attr.y]="geo.originYInches + 10"
                text-anchor="middle"
                class="layout-label"
              >
                Bed · {{ bed.name }} ·
                {{ formatPlanSize(geo.lengthInches, geo.widthInches, undefined, units()) }}
              </text>
              @for (name of priorNames(bed.id); track name) {
                <text
                  [attr.x]="geo.originXInches + planSize(geo).width / 2"
                  [attr.y]="geo.originYInches + planSize(geo).height - 8 - $index * 8"
                  text-anchor="middle"
                  class="layout-label-faded"
                >
                  {{ name }}
                </text>
              }
            }
            @if (!allowPlantingDrag()) {
              @for (label of labelsFor(bed.id); track label.name) {
                <text
                  [attr.x]="geo.originXInches + planSize(geo).width / 2"
                  [attr.y]="geo.originYInches + 22 + $index * 10"
                  text-anchor="middle"
                  class="layout-label"
                >
                  {{ label.count > 1 ? label.name + ' ×' + label.count : label.name }}
                </text>
              }
            }
            @if (canEdit() && allowBedGeometry()) {
              <rect
                [attr.x]="geo.originXInches + planSize(geo).width - handleInches"
                [attr.y]="geo.originYInches + planSize(geo).height - handleInches"
                [attr.width]="handleInches"
                [attr.height]="handleInches"
                class="layout-handle"
                [attr.aria-label]="'Resize ' + bed.name"
              />
            }
            @if (probeSpacing() != null) {
              @for (band of marginBands(geo); track $index) {
                <rect
                  [attr.x]="band.x"
                  [attr.y]="band.y"
                  [attr.width]="band.w"
                  [attr.height]="band.h"
                  class="layout-margin"
                  aria-hidden="true"
                />
              }
              @for (planting of placedIn(bed.id); track planting.id) {
                @if (blockMark(planting, geo); as blocked) {
                  <circle
                    [attr.cx]="blocked.x"
                    [attr.cy]="blocked.y"
                    [attr.r]="blocked.r"
                    class="layout-blocked"
                    aria-hidden="true"
                  />
                }
              }
            }
            @if (showPlantingMarks()) {
              @for (planting of placedIn(bed.id); track planting.id) {
                @if (mark(planting, geo); as m) {
                  <g [attr.aria-label]="plantingLabel(planting)" role="img">
                    <circle
                      [attr.cx]="m.x"
                      [attr.cy]="m.y"
                      [attr.r]="m.r"
                      class="layout-plant"
                      [class.layout-plant-invalid]="isPreviewInvalid(planting.id)"
                      [attr.data-planting-id]="planting.id"
                    />
                    <text
                      [attr.x]="m.x"
                      [attr.y]="m.y"
                      text-anchor="middle"
                      dominant-baseline="central"
                      class="layout-plant-label"
                    >
                      {{ shortenMark(planting, m.r) }}
                    </text>
                  </g>
                }
              }
            }
          }
        }
        @for (area of drawnAreas(); track area.id) {
          <rect
            [attr.x]="area.originXInches"
            [attr.y]="area.originYInches"
            [attr.width]="area.lengthInches"
            [attr.height]="area.widthInches"
            class="layout-area"
            [attr.aria-label]="'Area ' + area.name"
            [attr.data-area-id]="area.id"
            [attr.data-area-name]="area.name"
            [attr.data-kind]="'area'"
            tabindex="0"
          />
          <text
            [attr.x]="area.originXInches + area.lengthInches / 2"
            [attr.y]="area.originYInches + 10"
            text-anchor="middle"
            class="layout-label"
          >
            Area · {{ area.name }} ·
            {{ formatPlanSize(area.lengthInches, area.widthInches, undefined, units()) }}
          </text>
          @if (canEdit() && allowBedGeometry()) {
            <rect
              [attr.x]="area.originXInches + area.lengthInches - handleInches"
              [attr.y]="area.originYInches + area.widthInches - handleInches"
              [attr.width]="handleInches"
              [attr.height]="handleInches"
              class="layout-handle"
              [attr.aria-label]="'Resize ' + area.name"
            />
          }
        }
        @if (probeGhost(); as ghost) {
          <circle
            [attr.cx]="ghost.x"
            [attr.cy]="ghost.y"
            [attr.r]="ghost.r"
            class="layout-probe"
            [class.layout-probe-bad]="!ghost.ok"
            aria-hidden="true"
          />
        }
      </svg>
    </div>
  `,
})
export class GardenPlanCanvas {
  readonly handleInches = HANDLE_INCHES;
  readonly planSize = bedPlanSize;
  readonly formatPlanSize = formatPlanSize;
  readonly units = inject(AuthApiService).units;

  priorNames(bedId: string): string[] {
    return this.priorCrops()
      .filter((crop) => crop.bedId === bedId)
      .map((crop) => crop.commonName);
  }
  readonly beds = input<LayoutBedDto[]>([]);
  readonly areas = input<LayoutAreaDto[]>([]);
  readonly plantings = input<LayoutPlantingDto[]>([]);
  readonly priorCrops = input<PriorCropDto[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly canEdit = input(false);
  readonly online = input(true);
  readonly allowBedGeometry = input(true);
  readonly allowPlantingDrag = input(true);
  readonly showPlantingMarks = input(true);
  readonly showBedCaption = input(true);
  /** Spacing of the plant being placed. Draws the room that spacing still has. */
  readonly probeSpacing = input<number | null>(null);
  readonly planLabel = input('Garden plan');
  /** Garden length and width. When both are set, the plot is that rectangle. */
  readonly plotLengthInches = input<number | null>(null);
  readonly plotWidthInches = input<number | null>(null);
  /**
   * Where to remember this plan's zoom and position in this browser, or null
   * to always open fitted to the beds.
   */
  readonly viewKey = input<string | null>(null);

  readonly focusBed = output<string>();
  readonly plantingDrop = output<{
    plantingId: string;
    before: LayoutPlantingDto;
    target: DropTarget;
  }>();
  readonly bedGeometry = output<{ bedId: string; geometry: BedGeometryDto }>();
  readonly areaGeometry = output<{ area: LayoutAreaDto }>();
  readonly gestureEnd = output<void>();
  readonly missedBed = output<void>();
  readonly offlineRequired = output<void>();
  readonly planActivate = output<void>();
  readonly planPointer = output<{ clientX: number; clientY: number }>();
  readonly selectPlanting = output<string | null>();

  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('planSvg');
  private readonly panX = signal(0);
  private readonly panY = signal(0);
  private readonly scale = signal(1);

  /** Set once the member zooms, pans, or fits; until then the view follows the plot. */
  private viewTouched = false;

  constructor() {
    // The plan can draw before the property's size arrives (cached layout
    // first), so open the view again when the plot changes, until touched.
    // After the member has zoomed or panned, a new plot keeps the same part
    // of the plan in view rather than the same pixels.
    let shownPlot: PlanFrame | null = null;
    afterRenderEffect(() => {
      const plot = this.plot();
      untracked(() => {
        const before = shownPlot;
        shownPlot = plot;
        if (!this.viewTouched) return this.openView();
        if (!before || formatPlanFrame(before) === formatPlanFrame(plot)) return;
        const size = this.viewportSize();
        const view = { scale: this.scale(), panX: this.panX(), panY: this.panY() };
        this.applyView(fitView(size, plot, visibleArea(size, before, view)));
      });
    });
    // The page around the plan can still settle after it first draws (the
    // side panel fills in), and windows get resized: keep the view until touched.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const host = this.svgRef()?.nativeElement.closest('.plan-viewport');
      if (!host || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        if (!this.viewTouched) this.openView();
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly previewPlant = signal<{ id: string; x: number; y: number } | null>(null);
  readonly probePoint = signal<{ x: number; y: number } | null>(null);
  private readonly previewInvalid = signal(false);
  private readonly previewBed = signal<{ id: string; geometry: BedGeometryDto } | null>(null);
  private readonly previewArea = signal<LayoutAreaDto | null>(null);
  private gesture: Gesture | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pointerStart = { x: 0, y: 0 };

  readonly drawnBeds = computed(() => {
    const preview = this.previewBed();
    return drawableBeds(this.beds()).map((bed) =>
      preview && bed.id === preview.id ? { ...bed, geometry: preview.geometry } : bed,
    );
  });

  readonly drawnAreas = computed(() => {
    const preview = this.previewArea();
    return this.areas().map((area) => (preview && area.id === preview.id ? preview : area));
  });

  private readonly plantingsByBed = computed(() => {
    const map = new Map<string, LayoutPlantingDto[]>();
    for (const planting of this.plantings()) {
      const bedId = planting.placement?.bedId;
      if (!bedId) continue;
      const list = map.get(bedId);
      if (list) list.push(planting);
      else map.set(bedId, [planting]);
    }
    return map;
  });

  private readonly overviewNamesByBed = computed(() => {
    const map = new Map<string, Array<{ name: string; count: number }>>();
    for (const label of overviewPlantingLabels(this.plantings())) {
      map.set(label.bedId, label.names);
    }
    return map;
  });

  readonly soilSize = soilSize;
  readonly gridLines = bedGridLines;

  /** Ids and sizes only, so a move does not refit the camera under the pointer. */
  private readonly structureKey = computed(() => {
    const beds = drawableBeds(this.beds())
      .map((bed) => {
        const geo = bed.geometry!;
        return `${bed.id}:${geo.lengthInches}:${geo.widthInches}:${geo.orientation}`;
      })
      .join(',');
    const areas = this.areas()
      .map((area) => `${area.id}:${area.lengthInches}:${area.widthInches}`)
      .join(',');
    return `${beds}|${areas}`;
  });

  private readonly camera = linkedSignal<string, PlanFrame>({
    source: () => this.structureKey(),
    computation: (_source, previous) => {
      const rects = untracked(() => contentRects(this.beds(), this.areas()));
      const next = frameAround(rects);
      if (previous && rectsFit(previous.value, rects)) return previous.value;
      return next;
    },
  });

  readonly plot = computed(() => {
    const length = this.plotLengthInches();
    const width = this.plotWidthInches();
    if (length != null && width != null) return { x: 0, y: 0, w: length, h: width };
    return this.camera();
  });

  readonly viewBox = computed(() => formatPlanFrame(this.plot()));

  readonly atPlotEdge = computed(() => {
    if (!this.allowBedGeometry()) return false;
    const frame = this.plot();
    for (const bed of this.drawnBeds()) {
      const geo = bed.geometry;
      if (!geo) continue;
      const size = bedPlanSize(geo);
      if (rectAtPlotEdge(frame, geo.originXInches, geo.originYInches, size.width, size.height)) {
        return true;
      }
    }
    for (const area of this.drawnAreas()) {
      if (
        rectAtPlotEdge(
          frame,
          area.originXInches,
          area.originYInches,
          area.lengthInches,
          area.widthInches,
        )
      ) {
        return true;
      }
    }
    return false;
  });

  readonly cssTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.scale()})`,
  );

  zoomIn() {
    this.zoomBy(1.25);
  }

  zoomOut() {
    this.zoomBy(0.8);
  }

  /** Shows every bed and walkway, as large as fits. */
  fit() {
    this.viewTouched = true;
    this.setView(this.fittedView());
  }

  private fittedView(): PlanView {
    const rects = contentRects(this.beds(), this.areas());
    return fitView(
      this.viewportSize(),
      this.plot(),
      rects.length ? frameAround(rects) : this.plot(),
    );
  }

  /** Opens on the view remembered for this plan, or fitted to the beds. */
  private openView() {
    const remembered = this.rememberedArea();
    const rects = contentRects(this.beds(), this.areas());
    const shows = (a: PlanFrame) =>
      rects.some((r) => r.x1 > a.x && r.x0 < a.x + a.w && r.y1 > a.y && r.y0 < a.y + a.h);
    if (remembered && (rects.length === 0 || shows(remembered))) {
      this.applyView(fitView(this.viewportSize(), this.plot(), remembered));
    } else {
      this.applyView(this.fittedView());
    }
  }

  private zoomBy(factor: number) {
    this.viewTouched = true;
    const { width, height } = this.viewportSize();
    const view = { scale: this.scale(), panX: this.panX(), panY: this.panY() };
    this.setView(zoomAbout(view, factor, { x: width / 2, y: height / 2 }));
  }

  private setView(view: PlanView) {
    this.applyView(view);
    this.rememberView();
  }

  private applyView(view: PlanView) {
    this.scale.set(view.scale);
    this.panX.set(view.panX);
    this.panY.set(view.panY);
  }

  private viewportSize() {
    const host = this.svgRef()?.nativeElement.closest('.plan-viewport') as HTMLElement | null;
    return { width: host?.clientWidth ?? 0, height: host?.clientHeight ?? 0 };
  }

  /** The visible part of the plan, kept per property in this browser only. */
  private rememberView() {
    const key = this.viewKey();
    const size = this.viewportSize();
    if (!key || size.width <= 0 || size.height <= 0) return;
    const view = { scale: this.scale(), panX: this.panX(), panY: this.panY() };
    try {
      localStorage.setItem(key, JSON.stringify(visibleArea(size, this.plot(), view)));
    } catch {
      /* storage blocked or full: the plan still works, it just opens fitted next time */
    }
  }

  private rememberedArea(): PlanFrame | null {
    const key = this.viewKey();
    if (!key) return null;
    try {
      const area = JSON.parse(localStorage.getItem(key) ?? 'null') as PlanFrame | null;
      const valid =
        area && [area.x, area.y, area.w, area.h].every(Number.isFinite) && area.w > 0 && area.h > 0;
      return valid ? area : null;
    } catch {
      return null;
    }
  }

  viewportCenterPlan(): { x: number; y: number } {
    const svg = this.svgRef()?.nativeElement;
    const host = svg?.closest('.plan-viewport') as HTMLElement | null;
    if (!host) return { x: 0, y: 0 };
    const r = host.getBoundingClientRect();
    return this.clientToPlan(r.left + r.width / 2, r.top + r.height / 2);
  }

  onPlanKey(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.planActivate.emit();
    }
  }

  clientToPlan(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  containsPoint(clientX: number, clientY: number): boolean {
    const svg = this.svgRef()?.nativeElement;
    const host = (svg?.closest('.plan-viewport') as HTMLElement | null) ?? svg;
    if (!host) return false;
    const r = host.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  geometryOf(bed: LayoutBedDto): BedGeometryDto | null {
    return bed.geometry;
  }

  marginBands(geo: BedGeometryDto): PlanBox[] {
    const spacing = this.probeSpacing();
    return spacing == null ? [] : marginBands(geo, spacing);
  }

  blockMark(
    planting: LayoutPlantingDto,
    geo: BedGeometryDto,
  ): { x: number; y: number; r: number } | null {
    const spacing = this.probeSpacing();
    const place = planting.placement;
    if (spacing == null || !place) return null;
    const need = pairRequiredSpacing(spacing, planting.spacingInches);
    if (need == null) return null;
    const center = localToPlan(geo, place.xInches, place.yInches);
    return { ...center, r: need };
  }

  probeGhost(): { x: number; y: number; r: number; ok: boolean } | null {
    const spacing = this.probeSpacing();
    const point = this.probePoint();
    if (spacing == null || !point) return null;
    const bed = bedAt(this.drawnBeds(), point.x, point.y);
    const ok = bed
      ? catalogDropOutcome(bed, this.plantings(), point.x, point.y, spacing) === 'ok'
      : false;
    return { x: point.x, y: point.y, r: plantingFootprintRadius(spacing), ok };
  }

  placedIn(bedId: string) {
    return this.plantingsByBed().get(bedId) ?? NO_PLANTINGS;
  }

  labelsFor(bedId: string) {
    return this.overviewNamesByBed().get(bedId) ?? NO_NAMES;
  }

  mark(
    planting: LayoutPlantingDto,
    geo: BedGeometryDto,
  ): { x: number; y: number; r: number } | null {
    const preview = this.previewPlant();
    if (preview && preview.id === planting.id) {
      return { x: preview.x, y: preview.y, r: plantingFootprintRadius(planting.spacingInches) };
    }
    const place = planting.placement;
    if (!place) return null;
    const center = localToPlan(geo, place.xInches, place.yInches);
    return { ...center, r: plantingFootprintRadius(planting.spacingInches) };
  }

  shortenMark(planting: LayoutPlantingDto, radiusInches: number) {
    return shortenPlantingMarkName(planting.commonName, radiusInches);
  }

  isPreviewInvalid(plantingId: string) {
    const preview = this.previewPlant();
    return this.previewInvalid() && preview?.id === plantingId;
  }

  plantingLabel(p: LayoutPlantingDto) {
    return p.status === 'active' ? plantName(p) : `${plantName(p)} (removed from catalog)`;
  }

  onPointerDown(ev: PointerEvent) {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      this.gesture = {
        type: 'pinch',
        startDist: Math.hypot(b.x - a.x, b.y - a.y),
        startScale: this.scale(),
      };
      return;
    }
    const plan = this.clientToPlan(ev.clientX, ev.clientY);
    this.pointerStart = { x: ev.clientX, y: ev.clientY };
    // An armed Place/transplant click must not start a pan: a few pixels of
    // finger slip used to swallow the place with no notice.
    if (this.probeSpacing() != null && this.allowPlantingDrag() && this.canEdit()) {
      if (!this.online()) {
        this.offlineRequired.emit();
        this.gesture = null;
        return;
      }
      this.gesture = { type: 'place-catalog' };
      return;
    }
    const hit = hitTestPlan(
      this.drawnBeds(),
      this.plantings(),
      plan.x,
      plan.y,
      HANDLE_INCHES,
      this.allowBedGeometry() ? this.drawnAreas() : [],
      this.allowPlantingDrag(),
    );
    if (!this.canEdit()) {
      if (this.allowBedGeometry() && (hit.kind === 'bed' || hit.kind === 'bed-handle')) {
        const bed = this.drawnBeds().find((b) => b.id === hit.bedId);
        if (!bed?.geometry) return;
        this.gesture = {
          type: 'move-bed',
          bedId: bed.id,
          startX: plan.x,
          startY: plan.y,
          originX: bed.geometry.originXInches,
          originY: bed.geometry.originYInches,
        };
        return;
      }
      this.gesture = { type: 'pan', lastX: ev.clientX, lastY: ev.clientY };
      return;
    }
    const kind = classifyGesture(hit);
    if (kind !== 'pan' && !this.online()) {
      this.offlineRequired.emit();
      this.gesture = null;
      return;
    }
    if (
      kind === 'pan' ||
      hit.kind === 'empty' ||
      (hit.kind === 'planting' && !this.allowPlantingDrag())
    ) {
      this.gesture = { type: 'pan', lastX: ev.clientX, lastY: ev.clientY };
      return;
    }
    if (hit.kind === 'planting') {
      const before = this.plantings().find((p) => p.id === hit.plantingId);
      if (!before) return;
      this.gesture = { type: 'move-planting', plantingId: before.id, before };
      this.previewPlant.set({ id: before.id, x: plan.x, y: plan.y });
      return;
    }
    if (hit.kind === 'bed-handle') {
      if (!this.allowBedGeometry()) {
        this.gesture = { type: 'pan', lastX: ev.clientX, lastY: ev.clientY };
        return;
      }
      const bed = this.drawnBeds().find((b) => b.id === hit.bedId);
      if (!bed?.geometry) return;
      const size = bedPlanSize(bed.geometry);
      this.gesture = {
        type: 'resize-bed',
        bedId: bed.id,
        startX: plan.x,
        startY: plan.y,
        length: bed.geometry.lengthInches,
        width: bed.geometry.widthInches,
        planWidth: size.width,
        planHeight: size.height,
      };
      return;
    }
    if (hit.kind === 'bed') {
      if (!this.allowBedGeometry()) {
        this.gesture = { type: 'pan', lastX: ev.clientX, lastY: ev.clientY };
        return;
      }
      const bed = this.drawnBeds().find((b) => b.id === hit.bedId);
      if (!bed?.geometry) return;
      this.gesture = {
        type: 'move-bed',
        bedId: bed.id,
        startX: plan.x,
        startY: plan.y,
        originX: bed.geometry.originXInches,
        originY: bed.geometry.originYInches,
      };
      return;
    }
    if (hit.kind === 'area-handle') {
      if (!this.allowBedGeometry()) {
        this.gesture = { type: 'pan', lastX: ev.clientX, lastY: ev.clientY };
        return;
      }
      const area = this.drawnAreas().find((a) => a.id === hit.areaId);
      if (!area) return;
      this.gesture = {
        type: 'resize-area',
        areaId: area.id,
        startX: plan.x,
        startY: plan.y,
        length: area.lengthInches,
        width: area.widthInches,
      };
      return;
    }
    if (hit.kind === 'area') {
      const area = this.drawnAreas().find((a) => a.id === hit.areaId);
      if (!area) return;
      this.gesture = {
        type: 'move-area',
        areaId: area.id,
        startX: plan.x,
        startY: plan.y,
        originX: area.originXInches,
        originY: area.originYInches,
      };
    }
  }

  onPointerMove(ev: PointerEvent) {
    if (this.pointers.has(ev.pointerId)) {
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    }
    const g = this.gesture;
    if (this.probeSpacing() != null && !g) {
      this.probePoint.set(this.clientToPlan(ev.clientX, ev.clientY));
    }
    if (!g) return;
    if (g.type === 'pinch') {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      if (g.startDist > 0) {
        this.scale.set(
          Math.min(MAX_PLAN_SCALE, Math.max(MIN_PLAN_SCALE, g.startScale * (dist / g.startDist))),
        );
      }
      return;
    }
    if (g.type === 'pan') {
      this.panX.update((x) => x + (ev.clientX - g.lastX));
      this.panY.update((y) => y + (ev.clientY - g.lastY));
      this.gesture = { ...g, lastX: ev.clientX, lastY: ev.clientY };
      return;
    }
    const plan = this.clientToPlan(ev.clientX, ev.clientY);
    if (g.type === 'move-planting') {
      this.previewPlant.set({ id: g.plantingId, x: plan.x, y: plan.y });
      this.previewInvalid.set(this.previewWouldBlock(g.plantingId, plan.x, plan.y));
      return;
    }
    if (g.type === 'move-area') {
      if (!this.canEdit()) return;
      const area = this.areas().find((a) => a.id === g.areaId);
      if (!area) return;
      const next = originFromGrabOffset(g.originX, g.originY, g.startX, g.startY, plan.x, plan.y);
      const origin = clampOriginToPlot(
        this.plot(),
        snapHalfFoot(next.originXInches),
        snapHalfFoot(next.originYInches),
        area.lengthInches,
        area.widthInches,
      );
      this.previewArea.set({
        ...area,
        originXInches: origin.originXInches,
        originYInches: origin.originYInches,
      });
      return;
    }
    if (g.type === 'resize-area') {
      const area = this.areas().find((a) => a.id === g.areaId);
      if (!area) return;
      const size = clampSizeToPlot(
        this.plot(),
        area.originXInches,
        area.originYInches,
        g.length + (plan.x - g.startX),
        g.width + (plan.y - g.startY),
      );
      this.previewArea.set({
        ...area,
        lengthInches: size.width,
        widthInches: size.height,
      });
      return;
    }
    if (g.type === 'place-catalog') {
      this.probePoint.set(plan);
      return;
    }
    if (g.type !== 'move-bed' && g.type !== 'resize-bed') return;
    const bed = this.beds().find((b) => b.id === g.bedId);
    if (!bed?.geometry) return;
    if (g.type === 'move-bed') {
      if (!this.allowBedGeometry() || !this.canEdit()) return;
      const next = originFromGrabOffset(g.originX, g.originY, g.startX, g.startY, plan.x, plan.y);
      const size = bedPlanSize(bed.geometry);
      const origin = clampOriginToPlot(
        this.plot(),
        snapHalfFoot(next.originXInches),
        snapHalfFoot(next.originYInches),
        size.width,
        size.height,
      );
      this.previewBed.set({
        id: bed.id,
        geometry: {
          ...bed.geometry,
          originXInches: origin.originXInches,
          originYInches: origin.originYInches,
        },
      });
      return;
    }
    if (g.type !== 'resize-bed') return;
    const rotated = bed.geometry.orientation === 90 || bed.geometry.orientation === 270;
    const size = clampSizeToPlot(
      this.plot(),
      bed.geometry.originXInches,
      bed.geometry.originYInches,
      g.planWidth + (plan.x - g.startX),
      g.planHeight + (plan.y - g.startY),
    );
    this.previewBed.set({
      id: bed.id,
      geometry: {
        ...bed.geometry,
        lengthInches: rotated ? size.height : size.width,
        widthInches: rotated ? size.width : size.height,
      },
    });
  }

  onPointerUp(ev: PointerEvent) {
    this.pointers.delete(ev.pointerId);
    const g = this.gesture;
    this.gesture = null;
    const click =
      Math.hypot(ev.clientX - this.pointerStart.x, ev.clientY - this.pointerStart.y) < 8;
    if (g?.type === 'place-catalog') {
      this.planPointer.emit({ clientX: ev.clientX, clientY: ev.clientY });
      return;
    }
    if (g?.type === 'pan' || g?.type === 'pinch') {
      this.viewTouched = true;
      this.rememberView();
    }
    if (!g || g.type === 'pan' || g.type === 'pinch') {
      this.previewPlant.set(null);
      this.previewInvalid.set(false);
      this.previewBed.set(null);
      this.previewArea.set(null);
      if (g?.type === 'pan' && click && this.allowPlantingDrag()) {
        this.planPointer.emit({ clientX: ev.clientX, clientY: ev.clientY });
      }
      if (g?.type === 'pan' && click && this.showPlantingMarks()) {
        this.emitPlantingSelect(ev.clientX, ev.clientY);
      }
      return;
    }
    const plan = this.clientToPlan(ev.clientX, ev.clientY);
    if (g.type === 'move-bed' && isClickNotDrag(g.startX, g.startY, plan.x, plan.y)) {
      this.focusBed.emit(g.bedId);
      this.previewBed.set(null);
      return;
    }
    if (g.type === 'move-planting') {
      this.previewPlant.set(null);
      this.previewInvalid.set(false);
      if (click && this.showPlantingMarks()) {
        this.selectPlanting.emit(g.plantingId);
        return;
      }
      const overTray = Boolean(
        document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.unplaced-tray'),
      );
      const hit = hitTestPlan(this.drawnBeds(), this.plantings(), plan.x, plan.y, HANDLE_INCHES);
      const target: DropTarget = overTray
        ? { kind: 'tray' }
        : dropTargetAt(hit, this.plantings(), plan);
      this.plantingDrop.emit({ plantingId: g.plantingId, before: g.before, target });
      if (target.kind === 'empty') this.missedBed.emit();
      this.gestureEnd.emit();
      return;
    }
    if (g.type === 'move-area' || g.type === 'resize-area') {
      const preview = this.previewArea();
      this.previewArea.set(null);
      if (preview) this.areaGeometry.emit({ area: preview });
      this.gestureEnd.emit();
      return;
    }
    const preview = this.previewBed();
    this.previewBed.set(null);
    if (preview) this.bedGeometry.emit({ bedId: preview.id, geometry: preview.geometry });
    this.gestureEnd.emit();
  }

  private previewWouldBlock(plantingId: string, planX: number, planY: number): boolean {
    const planting = this.plantings().find((p) => p.id === plantingId);
    if (!planting) return false;
    const others = this.plantings().filter((p) => p.id !== plantingId);
    const bed = bedAt(this.drawnBeds(), planX, planY);
    if (!bed) return true;
    return catalogDropOutcome(bed, others, planX, planY, planting.spacingInches ?? 12) !== 'ok';
  }

  private emitPlantingSelect(clientX: number, clientY: number) {
    const plan = this.clientToPlan(clientX, clientY);
    const hit = hitTestPlan(this.drawnBeds(), this.plantings(), plan.x, plan.y, HANDLE_INCHES, []);
    this.selectPlanting.emit(hit.kind === 'planting' ? hit.plantingId : null);
  }
}
