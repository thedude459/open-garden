import { TestBed } from '@angular/core/testing';
import type { PlantingPatchDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { PlantingEditor } from './planting-editor';
import { planting } from './planting.testing';
import type { ClientBed, ClientPlanting } from './plantings-offline.queue';

const beds = [{ id: 'b1', name: 'North' }] as ClientBed[];

async function render(p: ClientPlanting) {
  const fixture = TestBed.createComponent(PlantingEditor);
  fixture.componentRef.setInput('planting', p);
  fixture.componentRef.setInput('beds', beds);
  const saved: PlantingPatchDto[] = [];
  const removed: true[] = [];
  fixture.componentInstance.save.subscribe((patch) => saved.push(patch));
  fixture.componentInstance.remove.subscribe(() => removed.push(true));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const field = <T extends HTMLElement>(name: string) => el.querySelector<T>(`[name="${name}"]`)!;
  const button = (name: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  const type = async (name: string, value: string) => {
    const input = field<HTMLInputElement>(name);
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    await fixture.whenStable();
  };
  return { fixture, el, field, button, type, saved, removed };
}

describe('PlantingEditor', () => {
  it('fills the saved dates and emits the edited planting', async () => {
    const view = await render(planting());
    expect(view.field<HTMLInputElement>('planted-p1').value).toBe('2027-05-01');
    view.field<HTMLInputElement>('harvested-p1').value = '2027-08-01';
    view.field<HTMLSelectElement>('bed-p1').value = 'b1';
    await view.type('note-p1', 'Staked');
    view.button('Save planting')!.click();
    expect(view.saved[0]).toMatchObject({
      plantedOn: '2027-05-01',
      harvestedOn: '2027-08-01',
      bedId: 'b1',
      note: 'Staked',
      life: 'annual',
    });
  });

  it('records a tree with rootstock, years to fruit, and spacing in feet', async () => {
    const view = await render(planting({ plantedYear: null }));
    await view.type('life-p1', 'tree');
    await view.type('rootstock-p1', 'M.26');
    await view.type('years-p1', '3');
    await view.type('feet-p1', '12');
    view.button('Save planting')!.click();
    expect(view.saved[0]).toMatchObject({
      life: 'tree',
      rootstock: 'M.26',
      yearsToFruit: 3,
      spacingFeet: 12,
      plantedYear: new Date().getFullYear(),
    });
  });

  it('puts the saved date back after a rejected save reloads the planting', async () => {
    const view = await render(planting());
    view.field<HTMLInputElement>('planted-p1').value = '2027-09-09';
    view.button('Save planting')!.click();
    view.fixture.componentRef.setInput('planting', planting());
    await view.fixture.whenStable();
    expect(view.field<HTMLInputElement>('planted-p1').value).toBe('2027-05-01');
  });

  it('keeps a date typed while an earlier save was in flight', async () => {
    const view = await render(planting());
    const planted = view.field<HTMLInputElement>('planted-p1');
    planted.value = '2027-06-01';
    view.button('Save planting')!.click();
    planted.value = '2027-07-01';
    view.fixture.componentRef.setInput('planting', planting({ plantedOn: '2027-06-01' }));
    await view.fixture.whenStable();
    expect(planted.value).toBe('2027-07-01');
  });

  it('removes only after confirming', async () => {
    const view = await render(planting());
    view.el.querySelector<HTMLButtonElement>('[aria-label="Remove Tomato"]')!.click();
    await view.fixture.whenStable();
    view.button('Cancel')!.click();
    await view.fixture.whenStable();
    expect(view.button('Confirm remove')).toBeUndefined();
    view.el.querySelector<HTMLButtonElement>('[aria-label="Remove Tomato"]')!.click();
    await view.fixture.whenStable();
    view.button('Confirm remove')!.click();
    expect(view.removed).toHaveLength(1);
  });

  it('disables Save while a save is running', async () => {
    const view = await render(planting());
    view.fixture.componentRef.setInput('saving', true);
    await view.fixture.whenStable();
    expect(view.button('Save planting')!.disabled).toBe(true);
  });

  describe('Repeat sowing', () => {
    it('emits every N weeks until a date', async () => {
      const view = await render(planting());
      const repeats: { everyWeeks: number; until: string }[] = [];
      view.fixture.componentInstance.repeat.subscribe((r) => repeats.push(r));
      view.button('Repeat sowing')!.click();
      await view.fixture.whenStable();
      await view.type('everyWeeks', '3');
      await view.type('repeatUntil', '2027-07-01');
      view.button('Add sowings')!.click();
      expect(repeats).toEqual([{ everyWeeks: 3, until: '2027-07-01' }]);
    });

    it('says what is missing instead of emitting', async () => {
      const view = await render(planting());
      const failures: string[] = [];
      view.fixture.componentInstance.failed.subscribe((m) => failures.push(m));
      view.button('Repeat sowing')!.click();
      await view.fixture.whenStable();
      view.button('Add sowings')!.click();
      expect(failures).toEqual(['Repeat every 1 to 12 weeks, until a date']);
    });

    it('is offered only for an annual with a sow date', async () => {
      expect((await render(planting({ plantedOn: null }))).button('Repeat sowing')).toBeUndefined();
      TestBed.resetTestingModule();
      expect(
        (await render(planting({ life: 'perennial' }))).button('Repeat sowing'),
      ).toBeUndefined();
    });
  });

  describe('Harvests (ADR 0038)', () => {
    it('logs a weight in grams and a count for the chosen day', async () => {
      const view = await render(planting());
      const logged: { harvestedOn: string; grams: number | null; count: number | null }[] = [];
      view.fixture.componentInstance.logHarvest.subscribe((h) => logged.push(h));
      await view.type('harvestOn', '2027-07-04');
      await view.type('harvestWeight', '2');
      await view.type('harvestCount', '6');
      view.button('Log harvest')!.click();
      expect(logged).toEqual([{ harvestedOn: '2027-07-04', grams: 907, count: 6 }]);
    });

    it('lists each harvest with a total, and deletes one', async () => {
      const view = await render(
        planting({
          harvests: [
            { harvestedOn: '2027-07-01', grams: 1000, count: null },
            { harvestedOn: '2027-07-08', grams: 500, count: 4 },
          ],
        }),
      );
      expect(view.el.textContent).toContain('Total: 3.3 lb and 4 picked');
      const deleted: string[] = [];
      view.fixture.componentInstance.deleteHarvest.subscribe((d) => deleted.push(d));
      view.el.querySelector<HTMLButtonElement>('button[aria-label^="Delete harvest of"]')!.click();
      expect(deleted).toEqual(['2027-07-01']);
    });
  });
});
