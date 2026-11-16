import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { BedStation, FavoriteListItemDto, PlantSummaryDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { NoticeService } from '../ui/notice.service';
import { BedPlantPanel } from './bed-plant-panel';

const plant = (
  id: string,
  plantType: PlantSummaryDto['plantType'],
  spacingInches: number | null = 12,
) =>
  ({
    id,
    commonName: id,
    species: id,
    cultivar: null,
    plantType,
    spacingInches,
  }) as PlantSummaryDto;

const favorite = (p: PlantSummaryDto, unavailable = false) =>
  ({ favoriteId: `f-${p.id}`, plant: p, unavailable }) as unknown as FavoriteListItemDto;

async function render(opts: {
  canEdit?: boolean;
  station?: BedStation | null;
  favorites?: FavoriteListItemDto[];
  search?: () => Promise<unknown>;
  bedEmpty?: boolean;
}) {
  const favorites = { list: vi.fn().mockResolvedValue({ items: opts.favorites ?? [] }) };
  const plants = { list: vi.fn(opts.search ?? (async () => ({ items: [], total: 0 }))) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FavoritesApiService, useValue: favorites },
      { provide: PlantsApiService, useValue: plants },
    ],
  });
  const said: string[] = [];
  vi.spyOn(TestBed.inject(NoticeService), 'error').mockImplementation(
    (message) => (said.push(message), true),
  );
  const fixture = TestBed.createComponent(BedPlantPanel);
  fixture.componentRef.setInput('gardenId', 'g1');
  fixture.componentRef.setInput('canEdit', opts.canEdit ?? true);
  fixture.componentRef.setInput('station', opts.station ?? null);
  fixture.componentRef.setInput('bedEmpty', opts.bedEmpty ?? false);
  fixture.componentRef.setInput('emptyBody', 'Nothing is planted in this bed yet.');
  const armed: string[] = [];
  fixture.componentInstance.armDown.subscribe(({ plant }) => armed.push(plant.id));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const place = (name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="Place ${name}"]`);
  const search = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(plants.list).toHaveBeenCalled());
    await fixture.whenStable();
  };
  return { fixture, el, place, search, armed, said, favorites };
}

describe('BedPlantPanel', () => {
  it('shows favorites a vegetable bed accepts, with spacing and still in the catalog', async () => {
    const view = await render({
      favorites: [
        favorite(plant('lettuce', 'vegetable')),
        favorite(plant('apple', 'tree')),
        favorite(plant('mystery', 'vegetable', null)),
        favorite(plant('gone', 'vegetable'), true),
      ],
    });
    await vi.waitFor(() => expect(view.place('lettuce')).not.toBeNull());
    expect(view.place('apple')).toBeNull();
    expect(view.place('mystery')).toBeNull();
    expect(view.place('gone')).toBeNull();
    view.place('lettuce')!.dispatchEvent(new Event('pointerdown'));
    expect(view.armed).toEqual(['lettuce']);
  });

  it('a tree bed lists trees and asks for a rootstock', async () => {
    const view = await render({
      station: 'tree',
      search: async () => ({ items: [plant('apple', 'tree'), plant('kale', 'vegetable')] }),
    });
    expect(view.el.querySelector('select[name="rootstock"]')).not.toBeNull();
    await view.search();
    expect(view.place('apple')).not.toBeNull();
    const select = view.el.querySelector<HTMLSelectElement>('select[name="rootstock"]')!;
    select.value = 'dwarf';
    select.dispatchEvent(new Event('change'));
    expect(view.fixture.componentInstance.rootstock()).toBe('dwarf');
  });

  it('says when nothing matches', async () => {
    const view = await render({ search: async () => ({ items: [] }) });
    await view.search();
    expect(view.el.textContent).toContain('No plants match');
  });

  it('says when the search fails', async () => {
    const failing = await render({ search: () => Promise.reject(new Error('down')) });
    await failing.search();
    await vi.waitFor(() => expect(failing.said).toContain('Could not search the catalog'));
  });

  it('a viewer sees the empty-bed note and no controls', async () => {
    const view = await render({ canEdit: false, bedEmpty: true });
    expect(view.el.textContent).toContain('This bed is empty');
    expect(view.el.querySelector('form')).toBeNull();
    expect(view.favorites.list).not.toHaveBeenCalled();
  });
});
