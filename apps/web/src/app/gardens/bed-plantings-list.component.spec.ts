import { TestBed } from '@angular/core/testing';
import type { LayoutPlantingDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { BedPlantingsList } from './bed-plantings-list';

const planting = (
  id: string,
  status: LayoutPlantingDto['status'] = 'active',
  dates: Partial<LayoutPlantingDto> = { plantedOn: '2026-05-01' },
) => ({ id, commonName: id, cultivar: null, status, ...dates }) as LayoutPlantingDto;

async function render(plantings: LayoutPlantingDto[], canEdit = true) {
  const fixture = TestBed.createComponent(BedPlantingsList);
  fixture.componentRef.setInput('plantings', plantings);
  fixture.componentRef.setInput('canEdit', canEdit);
  const removed: string[] = [];
  const planted: string[] = [];
  fixture.componentInstance.remove.subscribe((p) => removed.push(p.id));
  fixture.componentInstance.markPlanted.subscribe((p) => planted.push(p.id));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  return { fixture, el, byLabel, removed, planted };
}

describe('BedPlantingsList', () => {
  it('names each planting and marks ones gone from the catalog', async () => {
    const view = await render([planting('Basil'), planting('Okra', 'deprecated')]);
    expect(view.el.textContent).toContain('Basil');
    expect(view.el.textContent).toContain('Okra (removed from catalog)');
  });

  it('removes only after a confirm, and Cancel backs out', async () => {
    const view = await render([planting('Basil')]);
    view.byLabel('Remove from bed Basil')!.click();
    await view.fixture.whenStable();
    [...view.el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel')!.click();
    await view.fixture.whenStable();
    expect(view.byLabel('Confirm remove Basil')).toBeNull();
    view.byLabel('Remove from bed Basil')!.click();
    await view.fixture.whenStable();
    view.byLabel('Confirm remove Basil')!.click();
    expect(view.removed).toEqual(['Basil']);
  });

  it('a viewer sees the list without Remove, and an empty bed shows nothing', async () => {
    const view = await render([planting('Basil')], false);
    expect(view.byLabel('Remove from bed Basil')).toBeNull();
    const empty = await render([]);
    expect(empty.el.textContent).not.toContain('In this bed');
  });

  it('says which are planned, and marks one planted (ADR 0040)', async () => {
    const view = await render([
      planting('Basil'),
      planting('Kale', 'active', { plantedOn: null, plannedOn: '2027-04-10' }),
      planting('Dill', 'active', { plantedOn: null }),
    ]);
    expect(view.el.textContent).toContain('Kale · planned for');
    expect(view.el.textContent).toContain('Dill · planned');
    expect(view.byLabel('Mark Basil planted today')).toBeNull();
    view.byLabel('Mark Kale planted today')!.click();
    expect(view.planted).toEqual(['Kale']);
  });
});
