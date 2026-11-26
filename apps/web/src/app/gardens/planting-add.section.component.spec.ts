import { TestBed } from '@angular/core/testing';
import type { PlantSummaryDto, TrayDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { NoticeService } from '../ui/notice.service';
import { PlantingAddSection, type PlantToAdd } from './planting-add.section';
import { settled } from '../settled';

const plant = (id: string, plantType: PlantSummaryDto['plantType']): PlantSummaryDto =>
  ({ id, commonName: id, species: id, cultivar: null, plantType }) as PlantSummaryDto;

const tray = (id: string): TrayDto => ({ id, areaId: 'gh', name: `Tray ${id}` });

async function render(opts: { trays?: TrayDto[]; hits?: PlantSummaryDto[]; favorites?: unknown }) {
  const plants = { list: vi.fn().mockResolvedValue({ items: opts.hits ?? [], total: 0 }) };
  const favorites = {
    list:
      opts.favorites instanceof Error
        ? vi.fn().mockRejectedValue(opts.favorites)
        : vi.fn().mockResolvedValue({ items: opts.favorites ?? [] }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PlantsApiService, useValue: plants },
      { provide: FavoritesApiService, useValue: favorites },
    ],
  });
  const said: string[] = [];
  vi.spyOn(TestBed.inject(NoticeService), 'error').mockImplementation(
    (message) => (said.push(message), true),
  );
  const fixture = TestBed.createComponent(PlantingAddSection);
  fixture.componentRef.setInput('trays', opts.trays ?? []);
  const added: PlantToAdd[] = [];
  const started: { plant: PlantToAdd; trayId: string }[] = [];
  fixture.componentInstance.add.subscribe((p) => added.push(p));
  fixture.componentInstance.startInTray.subscribe((s) => started.push(s));
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const search = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(plants.list).toHaveBeenCalled());
    await settled(fixture);
  };
  return { fixture, el, byLabel, search, added, started, said };
}

describe('PlantingAddSection', () => {
  it('lists catalog hits a vegetable area accepts and adds the chosen one', async () => {
    const view = await render({ hits: [plant('tomato', 'vegetable'), plant('apple', 'tree')] });
    await view.search();
    expect(view.byLabel('Add apple')).toBeNull();
    view.byLabel('Add tomato')!.click();
    expect(view.added.map((p) => p.id)).toEqual(['tomato']);
    expect(view.byLabel('Start tomato in a tray')).toBeNull();
  });

  it('starts seedlings in the first tray, or the one chosen', async () => {
    const view = await render({ trays: [tray('a'), tray('b')], hits: [plant('basil', 'herb')] });
    await view.search();
    view.byLabel('Start basil in a tray')!.click();
    const select = view.el.querySelector<HTMLSelectElement>('select[name="startTray"]')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    await settled(view.fixture);
    view.byLabel('Start basil in a tray')!.click();
    expect(view.started.map((s) => s.trayId)).toEqual(['a', 'b']);
  });

  it('offers no tray choice with a single tray', async () => {
    const view = await render({ trays: [tray('a')] });
    expect(view.el.querySelector('select[name="startTray"]')).toBeNull();
  });

  it('shows favorites to add', async () => {
    const view = await render({
      favorites: [{ favoriteId: 'f1', plant: plant('pea', 'vegetable') }],
    });
    [...view.el.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Show favorites'))!
      .click();
    await vi.waitFor(() => expect(view.byLabel('Add favorite pea')).not.toBeNull());
    view.byLabel('Add favorite pea')!.click();
    expect(view.added.map((p) => p.id)).toEqual(['pea']);
  });

  it('says so when favorites cannot load', async () => {
    const view = await render({ favorites: new Error('offline') });
    [...view.el.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Show favorites'))!
      .click();
    await vi.waitFor(() => expect(view.said).toContain('Could not load your favorites'));
  });
});
