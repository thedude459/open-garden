import { TestBed } from '@angular/core/testing';
import type { PropertyAreaDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { AreaPanel, type AreaBed } from './area-panel';
import { settled } from '../settled';

async function render(
  area: PropertyAreaDto,
  beds = 0,
  trays = 0,
  canEdit = true,
  bedList: AreaBed[] = [],
) {
  const fixture = TestBed.createComponent(AreaPanel);
  fixture.componentRef.setInput('area', area);
  fixture.componentRef.setInput('canEdit', canEdit);
  fixture.componentRef.setInput('beds', bedList);
  fixture.componentRef.setInput('bedCount', beds);
  fixture.componentRef.setInput('trayCount', trays);
  fixture.componentRef.setInput('saveTest', async () => true);
  fixture.componentRef.setInput('removeTest', async () => true);
  const renamed: string[] = [];
  let removed = 0;
  fixture.componentInstance.rename.subscribe((name) => renamed.push(name));
  fixture.componentInstance.remove.subscribe(() => removed++);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  return { fixture, el, byLabel, renamed, removed: () => removed };
}

const veg: PropertyAreaDto = { id: 'a1', name: 'Vegetable garden', kind: 'vegetable' };

describe('AreaPanel', () => {
  it('renames, ignoring an unchanged or blank name', async () => {
    const view = await render(veg, 2);
    const input = view.el.querySelector<HTMLInputElement>('input[name="areaName-a1"]')!;
    view.byLabel('Rename Vegetable garden')!.click();
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    view.byLabel('Rename Vegetable garden')!.click();
    input.value = ' Kitchen garden ';
    input.dispatchEvent(new Event('input'));
    await settled(view.fixture);
    view.byLabel('Rename Vegetable garden')!.click();
    expect(view.renamed).toEqual(['Kitchen garden']);
  });

  it('says what it holds, and offers delete only when empty, after a confirm', async () => {
    const full = await render(veg, 2);
    expect(full.el.textContent).toContain('2 beds');
    expect(full.byLabel('Delete area Vegetable garden')).toBeNull();

    const empty = await render({ ...veg, name: 'Vegetable garden 2' });
    expect(empty.el.textContent).toContain('No beds yet');
    empty.byLabel('Delete area Vegetable garden 2')!.click();
    await settled(empty.fixture);
    empty.byLabel('Confirm delete area Vegetable garden 2')!.click();
    expect(empty.removed()).toBe(1);
  });

  it('counts trays in a greenhouse and offers no soil test there', async () => {
    const view = await render({ id: 'g1', name: 'Greenhouse', kind: 'greenhouse' }, 0, 1);
    expect(view.el.textContent).toContain('1 tray');
    expect(view.el.querySelector('og-soil-test-panel')).toBeNull();
    expect(view.byLabel('Delete area Greenhouse')).toBeNull();
  });

  it('lists its beds, what grows in each, and a bed’s own soil test; read-only for viewers', async () => {
    const view = await render(veg, 2, 0, false, [
      {
        id: 'b1',
        name: 'North',
        plants: ['Tomato', 'Basil'],
        soilTest: {
          id: 't',
          areaId: null,
          bedId: 'b1',
          testedOn: '2026-04-01',
          lab: null,
          ph: 6.5,
          organicMatterPct: null,
          nitrogen: null,
          phosphorus: null,
          potassium: null,
          recommendations: null,
        },
      },
      { id: 'b2', name: 'South', plants: [], soilTest: null },
    ]);
    const items = [...view.el.querySelectorAll('.area-beds li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toEqual([
      'North: Tomato, Basil · its own soil test: pH 6.5, Apr 1, 2026',
      'South: nothing planted',
    ]);
    expect(view.el.querySelector('input')).toBeNull();
    expect(view.byLabel('Rename Vegetable garden')).toBeNull();
    expect([...view.el.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([]);
  });
});
