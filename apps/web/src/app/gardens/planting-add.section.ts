import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  allowsPlant,
  plantName,
  type FavoriteListItemDto,
  type PlantSummaryDto,
  type TrayDto,
} from '@open-garden/shared-types';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantPicker } from '../plants/plant-picker';
import { NoticeService } from '../ui/notice.service';
import { gardenErrorMessage } from './garden-error-message';

export type PlantToAdd = Pick<
  PlantSummaryDto,
  'id' | 'commonName' | 'species' | 'cultivar' | 'plantType'
> & { status?: string };

/** Finds plants in the catalog or the member's favorites to record as plantings. */
@Component({
  selector: 'og-planting-add',
  standalone: true,
  imports: [FormsModule, PlantPicker],
  template: `
    <og-plant-picker
      inputName="plantingSearch"
      searchLabel="Search catalog to add"
      placeholder="Search catalog to add"
      submitLabel="Search catalog"
      (results)="onCatalog($event)"
      (failed)="notices.error(gardenErrorMessage($event, 'Could not search the catalog'))"
    >
      <button type="button" class="btn btn-secondary" (click)="loadFavorites()">
        Show favorites
      </button>
    </og-plant-picker>
    @if (trays().length > 1) {
      <label>
        Tray
        <select name="startTray" [ngModel]="trayId()" (ngModelChange)="chosenTray.set($event)">
          @for (tray of trays(); track tray.id) {
            <option [value]="tray.id">{{ tray.name }}</option>
          }
        </select>
      </label>
    }
    @if (catalogHits().length) {
      <ul class="card-list">
        @for (p of catalogHits(); track p.id) {
          <li class="row">
            <span>{{ plantName(p) }}</span>
            <button
              type="button"
              class="btn btn-secondary"
              [attr.aria-label]="'Add ' + plantName(p)"
              (click)="add.emit(p)"
            >
              Add
            </button>
            @if (trayId(); as tray) {
              <button
                type="button"
                class="btn btn-secondary"
                [attr.aria-label]="'Start ' + plantName(p) + ' in a tray'"
                (click)="startInTray.emit({ plant: p, trayId: tray })"
              >
                Start in tray
              </button>
            }
          </li>
        }
      </ul>
    }
    @if (favorites().length) {
      <h3>Your favorites</h3>
      <ul class="card-list">
        @for (f of favorites(); track f.favoriteId) {
          <li class="row">
            <span>{{ plantName(f.plant) }}</span>
            <button
              type="button"
              class="btn btn-secondary"
              [attr.aria-label]="'Add favorite ' + plantName(f.plant)"
              (click)="add.emit(f.plant)"
            >
              Add
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class PlantingAddSection {
  readonly plantName = plantName;
  readonly gardenErrorMessage = gardenErrorMessage;
  readonly notices = inject(NoticeService);
  private readonly favoritesApi = inject(FavoritesApiService);

  trays = input<TrayDto[]>([]);
  add = output<PlantToAdd>();
  startInTray = output<{ plant: PlantToAdd; trayId: string }>();

  catalogHits = signal<PlantSummaryDto[]>([]);
  favorites = signal<FavoriteListItemDto[]>([]);
  chosenTray = signal('');
  /** The chosen tray while it still exists, else the first one. */
  trayId = computed(() => {
    const trays = this.trays();
    return trays.find((tray) => tray.id === this.chosenTray())?.id ?? trays[0]?.id ?? '';
  });

  onCatalog(items: PlantSummaryDto[]) {
    this.catalogHits.set(items.filter((plant) => allowsPlant('vegetable', plant.plantType)));
  }

  async loadFavorites() {
    try {
      this.favorites.set((await this.favoritesApi.list()).items);
    } catch (err) {
      this.notices.error(gardenErrorMessage(err, 'Could not load your favorites'));
    }
  }
}
