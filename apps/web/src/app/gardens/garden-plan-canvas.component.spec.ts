import { TestBed } from '@angular/core/testing';
import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameAround, visibleArea } from '@open-garden/garden-layout';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { settled } from '../settled';

const bed: LayoutBedDto = {
  id: 'b1',
  name: 'North',
  geometry: {
    originXInches: 120,
    originYInches: 60,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};

/** jsdom lays nothing out, so give the plan's viewport a size: 800 × 400 px. */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

async function render(viewKey: string | null = 'og-plan-view:g1') {
  const fixture = TestBed.createComponent(GardenPlanCanvas);
  fixture.componentRef.setInput('beds', [bed]);
  // A 100 × 50 ft property: the bed is small in it.
  fixture.componentRef.setInput('plotLengthInches', 1200);
  fixture.componentRef.setInput('plotWidthInches', 600);
  fixture.componentRef.setInput('viewKey', viewKey);
  fixture.autoDetectChanges();
  await settled(fixture);
  const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
  const scale = () => Number(/scale\(([\d.]+)\)/.exec(svg.style.transform)![1]);
  return { fixture, canvas: fixture.componentInstance, scale };
}

describe('GardenPlanCanvas view', () => {
  it('opens fitted to the beds, not the whole property', async () => {
    const view = await render();
    // The bed and its margin fill the view, well past the property-wide 1×.
    expect(view.scale()).toBeGreaterThan(4);
  });

  it('remembers the zoom per property and opens there next time', async () => {
    const first = await render();
    first.canvas.zoomOut();
    first.canvas.zoomOut();
    await settled(first.fixture);
    const zoomed = first.scale();
    expect(localStorage.getItem('og-plan-view:g1')).not.toBeNull();
    first.fixture.destroy();

    const again = await render();
    expect(again.scale()).toBeCloseTo(zoomed, 5);
  });

  it('opens fitted when the remembered view no longer shows any bed', async () => {
    localStorage.setItem('og-plan-view:g1', JSON.stringify({ x: 900, y: 400, w: 100, h: 50 }));
    const view = await render();
    const fitted = (await render(null)).scale();
    expect(view.scale()).toBeCloseTo(fitted, 5);
  });

  it('fits again when the property size arrives after the plan is drawn', async () => {
    const fixture = TestBed.createComponent(GardenPlanCanvas);
    fixture.componentRef.setInput('beds', [bed]);
    fixture.autoDetectChanges();
    await settled(fixture);
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    const scale = () => Number(/scale\(([\d.]+)\)/.exec(svg.style.transform)![1]);
    // Before the size arrives the plan frames the bed itself.
    expect(scale()).toBeCloseTo(1, 0);
    fixture.componentRef.setInput('plotLengthInches', 1200);
    fixture.componentRef.setInput('plotWidthInches', 600);
    await settled(fixture);
    expect(scale()).toBeGreaterThan(4);
  });

  it('keeps the same part of the plan in view when the size arrives after a zoom', async () => {
    const fixture = TestBed.createComponent(GardenPlanCanvas);
    fixture.componentRef.setInput('beds', [bed]);
    fixture.autoDetectChanges();
    await settled(fixture);
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    const view = () => {
      const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([\d.e]+)\)/.exec(
        svg.style.transform,
      )!;
      return { panX: Number(m[1]), panY: Number(m[2]), scale: Number(m[3]) };
    };
    const size = { width: 800, height: 400 };
    fixture.componentInstance.zoomOut();
    await settled(fixture);
    // Before the size arrives the plot frames the bed (with its margin).
    const camera = frameAround([{ x0: 120, y0: 60, x1: 216, y1: 108 }]);
    const before = visibleArea(size, camera, view());
    fixture.componentRef.setInput('plotLengthInches', 1200);
    fixture.componentRef.setInput('plotWidthInches', 600);
    await settled(fixture);
    const after = visibleArea(size, { x: 0, y: 0, w: 1200, h: 600 }, view());
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
    expect(after.w).toBeCloseTo(before.w, 3);
  });

  it('Fit returns to the beds after zooming', async () => {
    const view = await render(null);
    const fitted = view.scale();
    view.canvas.zoomOut();
    await settled(view.fixture);
    expect(view.scale()).toBeLessThan(fitted);
    view.canvas.fit();
    await settled(view.fixture);
    expect(view.scale()).toBeCloseTo(fitted, 5);
  });
});

describe('GardenPlanCanvas keyboard', () => {
  it('on the plan, a bed is a button: Enter or Space selects it', async () => {
    const view = await render();
    view.fixture.componentRef.setInput('canEdit', true);
    await settled(view.fixture);
    const selected: string[] = [];
    view.canvas.focusBed.subscribe((id) => selected.push(id));
    const frame = (view.fixture.nativeElement as HTMLElement).querySelector('.layout-bed-frame')!;
    expect(frame.getAttribute('role')).toBe('button');
    expect(frame.getAttribute('tabindex')).toBe('0');
    expect(frame.getAttribute('aria-label')).toBe('North');
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(selected).toEqual(['b1', 'b1']);
    const handle = (view.fixture.nativeElement as HTMLElement).querySelector('.layout-handle')!;
    expect(handle.getAttribute('aria-hidden')).toBe('true');
  });

  it('in Bed View, a bed is a labelled picture and not a stop for Tab', async () => {
    const view = await render();
    view.fixture.componentRef.setInput('allowBedGeometry', false);
    await settled(view.fixture);
    const frame = (view.fixture.nativeElement as HTMLElement).querySelector('.layout-bed-frame')!;
    expect(frame.getAttribute('role')).toBe('img');
    expect(frame.hasAttribute('tabindex')).toBe(false);
  });
});

describe('GardenPlanCanvas planting marks', () => {
  it('draws a planned planting as an outline and says it is planned (ADR 0040)', async () => {
    const view = await render();
    const mark = (id: string, plantedOn: string | null) =>
      ({
        id,
        plantId: id,
        commonName: id,
        species: id,
        cultivar: null,
        plantType: 'vegetable',
        status: 'active',
        bedId: 'b1',
        spacingInches: 12,
        startMethod: 'direct_seed',
        indoorStartedOn: null,
        plantedOn,
        placement: { plantingId: id, bedId: 'b1', xInches: 24, yInches: 24 },
      }) as LayoutPlantingDto;
    view.fixture.componentRef.setInput('plantings', [
      mark('Kale', null),
      {
        ...mark('Basil', '2026-05-01'),
        placement: { plantingId: 'Basil', bedId: 'b1', xInches: 72, yInches: 24 },
      },
    ]);
    await settled(view.fixture);
    const el = view.fixture.nativeElement as HTMLElement;
    const labelled = (name: string) => el.querySelector(`g[aria-label="${name}"] circle`);
    expect(labelled('Kale, planned')?.classList.contains('layout-plant-planned')).toBe(true);
    expect(labelled('Basil')?.classList.contains('layout-plant-planned')).toBe(false);
  });
});

describe('GardenPlanCanvas area outlines', () => {
  it('outlines each area around its beds when two areas have beds', async () => {
    const fixture = TestBed.createComponent(GardenPlanCanvas);
    fixture.componentRef.setInput('beds', [
      { ...bed, areaId: 'veg' },
      {
        ...bed,
        id: 'b2',
        name: 'Apple',
        areaId: 'orchard',
        geometry: { ...bed.geometry!, originXInches: 300 },
      },
    ]);
    fixture.componentRef.setInput('plantingAreas', [
      { id: 'veg', name: 'Vegetable garden', kind: 'vegetable' },
      { id: 'orchard', name: 'Orchard', kind: 'fruit' },
    ]);
    fixture.autoDetectChanges();
    await settled(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const outlines = [...el.querySelectorAll('rect.area-outline')];
    expect(outlines.map((r) => r.getAttribute('data-outline-of'))).toEqual([
      'Vegetable garden',
      'Orchard',
    ]);
    expect(outlines[0]?.getAttribute('x')).toBe('108');
    expect(
      [...el.querySelectorAll('text.area-outline-label')].map((t) => t.textContent?.trim()),
    ).toEqual(['Vegetable garden', 'Orchard']);
  });
});
