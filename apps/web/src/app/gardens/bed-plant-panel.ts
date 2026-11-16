import { Component, OnInit, inject, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  allowsPlant,
  areaKindFor,
  plantName,
  ROOTSTOCK_LABELS,
  ROOTSTOCKS,
  type BedStation,
  type FavoriteListItemDto,
  type PlantSummaryDto,
  type Rootstock,
} from '@open-garden/shared-types';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantPicker } from '../plants/plant-picker';
import { EmptyState } from '../ui/empty-state';
import { NoticeService } from '../ui/notice.service';
import { gardenErrorMessage } from './garden-error-message';

/**
 * Bed View's plant panel: favorites and catalog search, filtered to what the
 * bed's area accepts, each with a Place button. The page does the placing.
 */
@Component({
  selector: 'og-bed-plant-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, PlantPicker, EmptyState],
  template: `
    @if (canEdit()) {
      <h3>Add a plant</h3>
      @if (station() === 'tree') {
        <label>
          Rootstock
          <select name="rootstock" [ngModel]="rootstock()" (ngModelChange)="rootstock.set($event)">
            @for (r of rootstocks; track r) {
              <option [value]="r">{{ rootstockLabels[r] }}</option>
            }
          </select>
        </label>
        <p class="muted">The tree's bed takes its spacing on this rootstock.</p>
      }
      @if (!armedId()) {
        <p class="muted">Drag Place onto the bed, or tap Place then tap the bed.</p>
      }
      @if (bedEmpty()) {
        <div class="empty-actions">
          <button type="button" class="btn btn-secondary" (click)="picker()?.focus()">
            Direct seed
          </button>
          <a class="btn btn-secondary" [routerLink]="['/gardens', gardenId(), 'transplants']">
            Transplants
          </a>
        </div>
      }
      @if (shownFavorites().length) {
        <h3>Favorites</h3>
        <ul class="card-list">
          @for (p of shownFavorites(); track p.id) {
            <li class="row">
              <span>
                <strong>{{ plantName(p) }}</strong>
                <span class="muted"> · {{ p.plantType }}</span>
              </span>
              <button
                type="button"
                class="btn btn-primary"
                [attr.aria-label]="'Place ' + plantName(p)"
                [attr.aria-pressed]="armedId() === p.id"
                (pointerdown)="armDown.emit({ event: $event, plant: p })"
              >
                Place
              </button>
            </li>
          }
        </ul>
      }
      <og-plant-picker
        [filters]="true"
        [live]="true"
        [zone]="zone()"
        (results)="onCatalog($event)"
        (searched)="searched.set(true)"
        (zoneChange)="activeZone.set($event)"
        (failed)="onSearchFailed($event)"
      />
      @if (searched() && catalogHits().length === 0) {
        <og-empty-state title="No plants match" body="Try another name or clear filters." />
      }
      @if (catalogHits().length) {
        <ul class="card-list plant-panel-list">
          @for (p of catalogHits(); track p.id) {
            <li class="row">
              @if (p.illustrationUrl) {
                <img [src]="p.illustrationUrl" alt="" width="32" height="32" decoding="async" />
              } @else {
                <span class="plant-stand-in" [attr.data-plant-type]="p.plantType">{{
                  p.plantType.slice(0, 1)
                }}</span>
              }
              <span>
                <strong>{{ plantName(p) }}</strong>
                <span class="muted"> · {{ p.plantType }}</span>
                @if (activeZone() !== undefined) {
                  <span class="muted"> · Fits zone {{ activeZone() }}</span>
                }
              </span>
              <button
                type="button"
                class="btn btn-primary"
                [attr.aria-label]="'Place ' + plantName(p)"
                [attr.aria-pressed]="armedId() === p.id"
                (pointerdown)="armDown.emit({ event: $event, plant: p })"
              >
                Place
              </button>
            </li>
          }
        </ul>
      }
    } @else if (bedEmpty()) {
      <og-empty-state title="This bed is empty" [body]="emptyBody()" />
    }
  `,
})
export class BedPlantPanel implements OnInit {
  readonly plantName = plantName;
  readonly rootstocks = ROOTSTOCKS;
  readonly rootstockLabels = ROOTSTOCK_LABELS;
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly notices = inject(NoticeService);
  readonly picker = viewChild(PlantPicker);

  gardenId = input.required<string>();
  station = input<BedStation | null | undefined>(null);
  canEdit = input(false);
  /** The plant waiting to be placed, if any. */
  armedId = input<string | null>(null);
  zone = input<number | undefined>(undefined);
  bedEmpty = input(false);
  emptyBody = input('');
  /** The rootstock a tree placed in this bed grows on; it sets the bed's size. */
  rootstock = model<Rootstock>('semiDwarf');
  armDown = output<{ event: PointerEvent; plant: PlantSummaryDto }>();

  catalogHits = signal<PlantSummaryDto[]>([]);
  favorites = signal<FavoriteListItemDto[]>([]);
  searched = signal(false);
  activeZone = signal<number | undefined>(undefined);

  ngOnInit() {
    if (!this.canEdit()) return;
    this.favoritesApi
      .list()
      .then((page) => this.favorites.set(page.items))
      .catch(() => undefined);
  }

  private accepts(plant: Pick<PlantSummaryDto, 'plantType'>) {
    return allowsPlant(areaKindFor(this.station()), plant.plantType);
  }

  onCatalog(items: PlantSummaryDto[]) {
    this.catalogHits.set(items.filter((plant) => this.accepts(plant)));
  }

  onSearchFailed(err: unknown) {
    this.catalogHits.set([]);
    this.notices.error(gardenErrorMessage(err, 'Could not search the catalog'));
  }

  /** Favorites the bed accepts, with known spacing, that are still in the catalog. */
  shownFavorites(): PlantSummaryDto[] {
    return this.favorites().flatMap((favorite) => {
      const spacingInches = favorite.plant.spacingInches;
      if (favorite.unavailable || spacingInches == null) return [];
      const plant = { ...favorite.plant, spacingInches };
      return this.accepts(plant) ? [plant] : [];
    });
  }
}
