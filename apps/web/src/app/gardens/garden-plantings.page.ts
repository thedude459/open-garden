import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { assertDatePair } from '@open-garden/seasonal-plantings/dates';
import { normalizeBedName } from '@open-garden/seasonal-plantings/beds';
import { groupPlantings, type PlantingGroup } from '@open-garden/seasonal-plantings/group-plantings';
import type { FavoriteListItemDto, PlantSummaryDto } from '@open-garden/shared-types';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { PlantingsApiService } from './plantings-api.service';
import type { ClientPlanting, ClientPlantingList, QueueItem } from './plantings-offline.queue';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <p><a [routerLink]="['/gardens', gardenId]">Back to garden</a></p>
    <h2>Plantings</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @for (issue of failures(); track issue.key) {
      <p class="needs-attention" role="status">
        needs-attention: {{ issue.failedMessage }}
      </p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!list()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (canEdit()) {
        <form class="filters" (ngSubmit)="searchCatalog()">
          <input
            [(ngModel)]="searchQ"
            name="plantingSearch"
            placeholder="Search catalog to add"
          />
          <button type="submit">Search catalog</button>
          <button type="button" (click)="loadFavorites()">Show favorites</button>
        </form>
        @if (catalogHits().length) {
          <ul class="card-list">
            @for (p of catalogHits(); track p.id) {
              <li class="row">
                <span>{{ p.commonName }}</span>
                <button type="button" (click)="add(p)">Add {{ p.commonName }}</button>
              </li>
            }
          </ul>
        }
        @if (favorites().length) {
          <h3>Your favorites</h3>
          <ul class="card-list">
            @for (f of favorites(); track f.favoriteId) {
              <li class="row">
                <span>{{ f.plant.commonName }}</span>
                <button type="button" (click)="add(f.plant)">
                    Add favorite {{ f.plant.commonName }}
                </button>
              </li>
            }
          </ul>
        }
        <form class="filters" (ngSubmit)="createBed()">
          <input [(ngModel)]="bedName" name="bedName" placeholder="Bed name" />
          <button type="submit">Create bed</button>
        </form>
      }
      <div class="filters">
        <label>
          Bed
          <select
            name="bedFilter"
            [ngModel]="bedFilter"
            (ngModelChange)="bedFilter = $event"
          >
            <option value="">All beds</option>
            @for (b of list()!.beds; track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        @if (bedFilter) {
          <button type="button" (click)="clearFilter()">Show all</button>
        }
      </div>
      @if (visibleGroups().length === 0 && !list()!.plantings.length && !list()!.beds.length) {
        <p class="muted">No plantings yet. Search the catalog or your favorites to record one.</p>
      } @else if (visibleGroups().length === 0) {
        <p class="muted">No plantings match this bed filter.</p>
      } @else {
        @for (group of visibleGroups(); track group.key) {
          <section>
            <h3>
              {{ group.title }}
              @if (bedSync(group.bedId) === 'pending') {
                <span class="pending">pending</span>
              }
              @if (bedSync(group.bedId) === 'failed') {
                <span class="needs-attention">needs-attention</span>
              }
            </h3>
            @if (canEdit() && group.bedId) {
              <form class="filters" (ngSubmit)="renameBed(group)">
                <input
                  [ngModel]="renameDraft[group.bedId] ?? group.title"
                  (ngModelChange)="renameDraft[group.bedId!] = $event"
                  [ngModelOptions]="{ standalone: true }"
                  [attr.name]="'rename-' + group.bedId"
                />
                <button type="submit">Rename {{ group.title }}</button>
                <button type="button" (click)="deleteBed(group.bedId!)">
                  Delete bed {{ group.title }}
                </button>
              </form>
            }
            @if (group.plantings.length === 0) {
              <p class="muted">No plantings in this bed.</p>
            }
            <div class="card-list">
              @for (p of group.plantings; track p.id) {
                <article class="row" [class.pending-row]="p.sync === 'pending'" [class.needs-attention-row]="p.sync === 'failed'">
                  <div>
                    <strong>{{ p.commonName }}</strong>
                    <span class="muted">
                      · {{ p.species }}
                      @if (p.cultivar) {
                        · {{ p.cultivar }}
                      }
                    </span>
                    @if (p.status !== 'active') {
                      <span class="badge">Unavailable variety</span>
                    }
                    @if (p.sync === 'pending') {
                      <span class="pending">pending</span>
                    }
                    @if (p.sync === 'failed') {
                      <span class="needs-attention">needs-attention: {{ p.syncMessage }}</span>
                    }
                    <p>
                      Planted
                      @if (!p.plantedOn) {
                        <span class="muted">Not set</span>
                      }
                      <input
                        #plantedInput
                        type="date"
                        [attr.name]="'planted-' + p.id"
                        [disabled]="!canEdit()"
                      />
                    </p>
                    <p>
                      Harvest
                      @if (!p.harvestedOn) {
                        <span class="muted">Not set</span>
                      }
                      <input
                        #harvestInput
                        type="date"
                        [attr.name]="'harvested-' + p.id"
                        [disabled]="!canEdit()"
                      />
                    </p>
                    @if (canEdit()) {
                      <label>
                        Bed
                        <select #bedSelect [attr.name]="'bed-' + p.id">
                          <option value="" [selected]="!p.bedId">Unassigned</option>
                          @for (b of list()!.beds; track b.id) {
                            <option [value]="b.id" [selected]="p.bedId === b.id">{{ b.name }}</option>
                          }
                        </select>
                      </label>
                      <button type="button" (click)="save(p, plantedInput.value, harvestInput.value, bedSelect.value)">Save planting</button>
                    }
                  </div>
                  @if (canEdit()) {
                    @if (confirmRemoveId() !== p.id) {
                      <button type="button" (click)="confirmRemoveId.set(p.id)">
                        Remove {{ p.commonName }}
                      </button>
                    } @else {
                      <span>
                        <p>Permanently remove this planting? This cannot be undone.</p>
                        <button type="button" (click)="confirmRemove(p)">Confirm remove</button>
                        <button type="button" (click)="confirmRemoveId.set(null)">Cancel</button>
                      </span>
                    }
                  }
                </article>
              }
            </div>
          </section>
        }
      }
    }
  `,
})
export class GardenPlantingsPage implements OnInit {
  private readonly api = inject(PlantingsApiService);
  private readonly plants = inject(PlantsApiService);
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly route = inject(ActivatedRoute);
  gardenId = '';
  list = signal<ClientPlantingList | null>(null);
  loading = signal(true);
  error = signal('');
  confirmRemoveId = signal<string | null>(null);
  failures = signal<QueueItem[]>([]);
  searchQ = '';
  bedName = '';
  bedFilter = '';
  renameDraft: Record<string, string> = {};
  catalogHits = signal<PlantSummaryDto[]>([]);
  favorites = signal<FavoriteListItemDto[]>([]);

  constructor() {
    const onOnline = () => void this.load();
    window.addEventListener('online', onOnline);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('online', onOnline));
  }

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
  }

  canEdit() {
    const role = this.list()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  visibleGroups(): PlantingGroup<ClientPlanting>[] {
    const list = this.list();
    if (!list) return [];
    const groups = groupPlantings(list.plantings, list.beds);
    if (!this.bedFilter) return groups;
    return groups.filter((group) => group.key === this.bedFilter);
  }

  clearFilter() {
    this.bedFilter = '';
  }

  bedSync(bedId: string | null): 'pending' | 'failed' | undefined {
    if (!bedId) return undefined;
    return this.list()?.beds.find((bed) => bed.id === bedId)?.sync;
  }

  async load(silent = false) {
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      const list = await this.api.list(this.gardenId);
      this.list.set(list);
      this.failures.set(await this.api.syncFailures(this.gardenId));
      this.syncDateInputs();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
    if (!silent) this.loading.set(false);
  }

  async searchCatalog() {
    this.error.set('');
    const page = await this.plants.list({ q: this.searchQ, page: 1, pageSize: 20 });
    this.catalogHits.set(page.items);
  }

  async loadFavorites() {
    this.error.set('');
    const page = await this.favoritesApi.list();
    this.favorites.set(page.items);
  }

  async add(plant: PlantSummaryDto & { status?: string }) {
    this.error.set('');
    try {
      this.list.set(
        await this.api.create(
          this.gardenId,
          { plantId: plant.id },
          {
            commonName: plant.commonName,
            species: plant.species,
            cultivar: plant.cultivar,
            plantType: plant.plantType,
            status: plant.status === 'deprecated' ? 'deprecated' : 'active',
          },
        ),
      );
      this.failures.set(await this.api.syncFailures(this.gardenId));
      this.syncDateInputs();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async save(planting: ClientPlanting, plantedOn: string, harvestedOn: string, bedId: string) {
    this.error.set('');
    const planted = plantedOn || null;
    const harvested = harvestedOn || null;
    const bed = bedId || null;
    try {
      assertDatePair(planted, harvested);
      const saved = await this.api.update(this.gardenId, planting.id, {
        plantedOn: planted,
        harvestedOn: harvested,
        bedId: bed,
      });
      const list = this.list();
      if (list) {
        this.list.set({
          ...list,
          plantings: list.plantings.map((row) =>
            row.id === saved.id ? { ...row, ...saved } : row,
          ),
        });
      }
      this.failures.set(await this.api.syncFailures(this.gardenId));
    } catch (err) {
      this.error.set(messageFrom(err));
      await this.load(true);
    }
  }

  private syncDateInputs() {
    queueMicrotask(() => {
      for (const planting of this.list()?.plantings ?? []) {
        const planted = document.querySelector(
          `input[name="planted-${planting.id}"]`,
        ) as HTMLInputElement | null;
        const harvested = document.querySelector(
          `input[name="harvested-${planting.id}"]`,
        ) as HTMLInputElement | null;
        if (planted && document.activeElement !== planted) {
          planted.value = planting.plantedOn ?? '';
        }
        if (harvested && document.activeElement !== harvested) {
          harvested.value = planting.harvestedOn ?? '';
        }
      }
    });
  }

  async confirmRemove(planting: ClientPlanting) {
    this.error.set('');
    try {
      await this.api.remove(this.gardenId, planting.id);
      this.confirmRemoveId.set(null);
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async createBed() {
    this.error.set('');
    try {
      const { name } = normalizeBedName(this.bedName);
      await this.api.createBed(this.gardenId, { name });
      this.bedName = '';
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async renameBed(group: PlantingGroup<ClientPlanting>) {
    if (!group.bedId) return;
    this.error.set('');
    try {
      const { name } = normalizeBedName(this.renameDraft[group.bedId] ?? group.title);
      await this.api.renameBed(this.gardenId, group.bedId, name);
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async deleteBed(bedId: string) {
    this.error.set('');
    try {
      await this.api.deleteBed(this.gardenId, bedId);
      if (this.bedFilter === bedId) this.bedFilter = '';
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Could not update plantings';
}
