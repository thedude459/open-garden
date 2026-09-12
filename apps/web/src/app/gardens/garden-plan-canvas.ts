import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { originFromGrabOffset, shortenPlantingMarkName, catalogDropOutcome, formatPlanSize } from '@open-garden/garden-layout';
import { classifyGesture, hitTestPlan, isClickNotDrag } from '@open-garden/garden-layout/hit-test';
import { plantingFootprintRadius } from '@open-garden/garden-layout/footprint';
import { drawableBeds } from '@open-garden/garden-layout/drawable-beds';
import { overviewPlantingLabels } from '@open-garden/garden-layout/overview-labels';
import { bedPlanSize, localToPlan } from '@open-garden/garden-layout/rotate';
import type { DropTarget } from '@open-garden/garden-layout/drop';
import type {
  BedGeometryDto,
  LayoutAreaDto,
  LayoutBedDto,
  LayoutPlantingDto,
} from '@open-garden/shared-types';

const HANDLE_INCHES = 8;
const NO_PLANTINGS: LayoutPlantingDto[] = [];
const NO_NAMES: Array<{ name: string; count: number }> = [];

type Gesture =
  | { type: 'pan'; lastX: number; lastY: number }
  | {
      type: 'move-planting';
      plantingId: string;
      before: LayoutPlantingDto;
    }
  | { type: 'move-bed'; bedId: string; startX: number; startY: number; originX: number; originY: number }
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
  | { type: 'move-area'; areaId: string; startX: number; startY: number; originX: number; originY: number }
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
    >
      <svg
        #planSvg
        class="layout-plan"
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
              [attr.aria-label]="'Open bed ' + bed.name"
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
              Bed · {{ bed.name }} · {{ formatPlanSize(geo.lengthInches, geo.widthInches) }}
            </text>
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
            Area · {{ area.name }} · {{ formatPlanSize(area.lengthInches, area.widthInches) }}
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
      </svg>
    </div>
  `,
})
export class GardenPlanCanvas {
  readonly handleInches = HANDLE_INCHES;
  readonly planSize = bedPlanSize;
  readonly formatPlanSize = formatPlanSize;
  readonly beds = input<LayoutBedDto[]>([]);
  readonly areas = input<LayoutAreaDto[]>([]);
  readonly plantings = input<LayoutPlantingDto[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly canEdit = input(false);
  readonly online = input(true);
  readonly allowBedGeometry = input(true);
  readonly allowPlantingDrag = input(true);
  readonly showPlantingMarks = input(true);
  readonly showBedCaption = input(true);
  readonly openBedOnClick = input(false);
  readonly planLabel = input('Garden plan');

  readonly selectBed = output<string>();
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
  private readonly previewPlant = signal<{ id: string; x: number; y: number } | null>(null);
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

  soilSize(geo: BedGeometryDto): { width: number; height: number } {
    const size = bedPlanSize(geo);
    return { width: Math.max(1, size.width - 6), height: Math.max(1, size.height - 6) };
  }

  readonly viewBox = computed(() => {
    const beds = this.drawnBeds();
    const areas = this.drawnAreas();
    if (!beds.length && !areas.length) return '0 0 240 160';
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const bed of beds) {
      const geo = bed.geometry!;
      const size = bedPlanSize(geo);
      minX = Math.min(minX, geo.originXInches);
      minY = Math.min(minY, geo.originYInches);
      maxX = Math.max(maxX, geo.originXInches + size.width);
      maxY = Math.max(maxY, geo.originYInches + size.height);
    }
    for (const area of areas) {
      minX = Math.min(minX, area.originXInches);
      minY = Math.min(minY, area.originYInches);
      maxX = Math.max(maxX, area.originXInches + area.lengthInches);
      maxY = Math.max(maxY, area.originYInches + area.widthInches);
    }
    const pad = 36;
    const width = Math.max(maxX - minX + pad * 2, 160);
    const height = Math.max(maxY - minY + pad * 2, 120);
    return `${minX - pad} ${minY - pad} ${Math.ceil(width)} ${Math.ceil(height)}`;
  });

  readonly cssTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.scale()})`,
  );

  zoomIn() {
    this.scale.update((s) => Math.min(4, s + 0.25));
  }

  zoomOut() {
    this.scale.update((s) => Math.max(0.5, s - 0.25));
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
    if (!svg) return false;
    const r = svg.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  geometryOf(bed: LayoutBedDto): BedGeometryDto | null {
    return bed.geometry;
  }

  gridLines(geo: BedGeometryDto): { x1: number; y1: number; x2: number; y2: number }[] {
    const size = bedPlanSize(geo);
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const inset = 3;
    for (let x = 12; x < size.width - inset; x += 12) {
      lines.push({
        x1: geo.originXInches + x,
        y1: geo.originYInches + inset,
        x2: geo.originXInches + x,
        y2: geo.originYInches + size.height - inset,
      });
    }
    for (let y = 12; y < size.height - inset; y += 12) {
      lines.push({
        x1: geo.originXInches + inset,
        y1: geo.originYInches + y,
        x2: geo.originXInches + size.width - inset,
        y2: geo.originYInches + y,
      });
    }
    return lines;
  }

  placedIn(bedId: string) {
    return this.plantingsByBed().get(bedId) ?? NO_PLANTINGS;
  }

  labelsFor(bedId: string) {
    return this.overviewNamesByBed().get(bedId) ?? NO_NAMES;
  }

  mark(planting: LayoutPlantingDto, geo: BedGeometryDto): { x: number; y: number; r: number } | null {
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
    return p.status === 'active' ? p.commonName : `${p.commonName} (removed from catalog)`;
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
    const hit = hitTestPlan(
      this.drawnBeds(),
      this.plantings(),
      plan.x,
      plan.y,
      HANDLE_INCHES,
      this.allowBedGeometry() ? this.drawnAreas() : [],
    );
    if (!this.canEdit()) {
      if (this.openBedOnClick() && (hit.kind === 'bed' || hit.kind === 'bed-handle')) {
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
    if (kind === 'pan' || hit.kind === 'empty' || (hit.kind === 'planting' && !this.allowPlantingDrag())) {
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
    if (!g) return;
    if (g.type === 'pinch') {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      if (g.startDist > 0) {
        this.scale.set(Math.min(4, Math.max(0.5, g.startScale * (dist / g.startDist))));
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
      this.previewArea.set({
        ...area,
        originXInches: next.originXInches,
        originYInches: next.originYInches,
      });
      return;
    }
    if (g.type === 'resize-area') {
      const area = this.areas().find((a) => a.id === g.areaId);
      if (!area) return;
      this.previewArea.set({
        ...area,
        lengthInches: Math.max(1, Math.round(g.length + (plan.x - g.startX))),
        widthInches: Math.max(1, Math.round(g.width + (plan.y - g.startY))),
      });
      return;
    }
    const bed = this.beds().find((b) => b.id === g.bedId);
    if (!bed?.geometry) return;
    if (g.type === 'move-bed') {
      if (!this.allowBedGeometry() || !this.canEdit()) return;
      const next = originFromGrabOffset(g.originX, g.originY, g.startX, g.startY, plan.x, plan.y);
      const geometry = {
        ...bed.geometry,
        originXInches: next.originXInches,
        originYInches: next.originYInches,
      };
      this.previewBed.set({ id: bed.id, geometry });
      return;
    }
    if (g.type !== 'resize-bed') return;
    const nextW = Math.max(1, Math.round(g.planWidth + (plan.x - g.startX)));
    const nextH = Math.max(1, Math.round(g.planHeight + (plan.y - g.startY)));
    const rotated = bed.geometry.orientation === 90 || bed.geometry.orientation === 270;
    this.previewBed.set({
      id: bed.id,
      geometry: {
        ...bed.geometry,
        lengthInches: rotated ? nextH : nextW,
        widthInches: rotated ? nextW : nextH,
      },
    });
  }

  onPointerUp(ev: PointerEvent) {
    this.pointers.delete(ev.pointerId);
    const g = this.gesture;
    this.gesture = null;
    const click =
      Math.hypot(ev.clientX - this.pointerStart.x, ev.clientY - this.pointerStart.y) < 8;
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
    if (g.type === 'move-bed' && this.openBedOnClick() && isClickNotDrag(g.startX, g.startY, plan.x, plan.y)) {
      this.selectBed.emit(g.bedId);
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
        document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest('[aria-label="Planting tray"]'),
      );
      const hit = hitTestPlan(this.drawnBeds(), this.plantings(), plan.x, plan.y, HANDLE_INCHES);
      const target: DropTarget = overTray ? { kind: 'tray' } : this.dropTarget(hit, plan);
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

  private dropTarget(
    hit: ReturnType<typeof hitTestPlan>,
    plan: { x: number; y: number },
  ): DropTarget {
    if (hit.kind === 'empty' || hit.kind === 'area' || hit.kind === 'area-handle') {
      return { kind: 'empty' };
    }
    if (hit.kind === 'bed' || hit.kind === 'bed-handle') {
      return { kind: 'bed', bedId: hit.bedId, planX: plan.x, planY: plan.y };
    }
    const planting = this.plantings().find((p) => p.id === hit.plantingId);
    const bedId = planting?.placement?.bedId;
    if (!bedId) return { kind: 'empty' };
    return { kind: 'bed', bedId, planX: plan.x, planY: plan.y };
  }

  private previewWouldBlock(plantingId: string, planX: number, planY: number): boolean {
    const planting = this.plantings().find((p) => p.id === plantingId);
    if (!planting) return false;
    const others = this.plantings().filter((p) => p.id !== plantingId);
    const bed =
      this.drawnBeds().find((b) => {
        if (!b.geometry) return false;
        const size = bedPlanSize(b.geometry);
        return (
          planX >= b.geometry.originXInches &&
          planX <= b.geometry.originXInches + size.width &&
          planY >= b.geometry.originYInches &&
          planY <= b.geometry.originYInches + size.height
        );
      }) ?? null;
    if (!bed) return true;
    return catalogDropOutcome(bed, others, planX, planY, planting.spacingInches ?? 12) !== 'ok';
  }

  private emitPlantingSelect(clientX: number, clientY: number) {
    const plan = this.clientToPlan(clientX, clientY);
    const hit = hitTestPlan(
      this.drawnBeds(),
      this.plantings(),
      plan.x,
      plan.y,
      HANDLE_INCHES,
      [],
    );
    this.selectPlanting.emit(hit.kind === 'planting' ? hit.plantingId : null);
  }
}
