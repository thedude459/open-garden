import { TestBed } from '@angular/core/testing';
import type { BedGeometryDto, LayoutBedDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { LayoutBedInspector, type BedSettingsPatch } from './layout-bed-inspector';

const bed = (over: Partial<LayoutBedDto> = {}): LayoutBedDto => ({
  id: 'b1',
  name: 'North',
  geometry: {
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
  ...over,
});

async function render(saved = true) {
  const fixture = TestBed.createComponent(LayoutBedInspector);
  fixture.componentRef.setInput('bed', bed());
  fixture.componentRef.setInput('saved', saved);
  fixture.componentRef.setInput('saveSoilTest', async () => true);
  fixture.componentRef.setInput('deleteSoilTest', async () => true);
  const settings: BedSettingsPatch[] = [];
  const geometry: Partial<BedGeometryDto>[] = [];
  let removed = 0;
  const c = fixture.componentInstance;
  c.settings.subscribe((p) => settings.push(p));
  c.geometryChange.subscribe((p) => geometry.push(p));
  c.remove.subscribe(() => removed++);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const field = <T extends HTMLElement>(name: string) => el.querySelector<T>(`[name="${name}"]`)!;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const fire = async (name: string, value: string, type: 'input' | 'change') => {
    const input = field<HTMLInputElement>(name);
    input.value = value;
    input.dispatchEvent(new Event(type));
    await fixture.whenStable();
  };
  return { fixture, el, field, byLabel, fire, settings, geometry, removed: () => removed };
}

describe('LayoutBedInspector', () => {
  it('renames and changes sun, ground, and mulch for a saved bed', async () => {
    const view = await render();
    await view.fire('selectedName', 'South', 'input');
    view.byLabel('Rename North')!.click();
    await view.fire('selectedSun', 'part', 'change');
    await view.fire('selectedMulch', 'leaves', 'change');
    expect(view.settings).toEqual([{ name: 'South' }, { sun: 'part' }, { mulch: 'leaves' }]);
  });

  it('keeps a typed name while the bed moves, and starts over for another bed', async () => {
    const view = await render();
    await view.fire('selectedName', 'South', 'input');
    view.fixture.componentRef.setInput(
      'bed',
      bed({ geometry: { ...bed().geometry!, originXInches: 12 } }),
    );
    await view.fixture.whenStable();
    expect(view.fixture.componentInstance.renameDraft()).toBe('South');
    view.fixture.componentRef.setInput('bed', bed({ id: 'b2', name: 'East' }));
    await view.fixture.whenStable();
    expect(view.fixture.componentInstance.renameDraft()).toBe('East');
  });

  it('a bed not yet saved asks for a save before its settings', async () => {
    const view = await render(false);
    expect(view.field('selectedName')).toBeNull();
    expect(view.el.textContent).toContain('Save the layout to set its name');
  });

  it('sizes snap to the half-foot grid as feet are typed; metres wait for change', async () => {
    const view = await render();
    await view.fire('length', '10.2', 'input');
    await view.fire('width', '0', 'input');
    expect(view.geometry).toEqual([{ lengthInches: 120 }, { widthInches: 6 }]);
    TestBed.inject(AuthApiService).units.set('metric');
    await view.fire('originX', '1', 'input');
    expect(view.geometry).toHaveLength(2);
    await view.fire('originX', '1', 'change');
    expect(view.geometry[2]).toEqual({ originXInches: 42 });
  });

  it('deletes only after a confirm, which another bed does not inherit', async () => {
    const view = await render();
    view.byLabel('Delete bed North')!.click();
    await view.fixture.whenStable();
    view.fixture.componentRef.setInput('bed', bed({ id: 'b2', name: 'East' }));
    await view.fixture.whenStable();
    expect(view.byLabel('Confirm delete East')).toBeNull();
    view.byLabel('Delete bed East')!.click();
    await view.fixture.whenStable();
    view.byLabel('Confirm delete East')!.click();
    expect(view.removed()).toBe(1);
  });

  it('moves the bed to another area, and puts the picker back when the move is refused', async () => {
    const fixture = TestBed.createComponent(LayoutBedInspector);
    const moves: string[] = [];
    let allow = false;
    fixture.componentRef.setInput('bed', bed({ areaId: 'veg' }));
    fixture.componentRef.setInput('saved', true);
    fixture.componentRef.setInput('saveSoilTest', async () => true);
    fixture.componentRef.setInput('deleteSoilTest', async () => true);
    fixture.componentRef.setInput('areas', [
      { id: 'veg', name: 'Vegetable garden', kind: 'vegetable' },
      { id: 'canes', name: 'Fruit garden', kind: 'fruit' },
    ]);
    fixture.componentRef.setInput('moveToArea', async (_b: LayoutBedDto, areaId: string) => {
      moves.push(areaId);
      return allow;
    });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select[name="selectedArea"]',
    )!;
    expect(select.value).toBe('veg');
    select.value = 'canes';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(moves).toEqual(['canes']);
    expect(select.value).toBe('veg');
    allow = true;
    select.value = 'canes';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(select.value).toBe('canes');
  });
});
