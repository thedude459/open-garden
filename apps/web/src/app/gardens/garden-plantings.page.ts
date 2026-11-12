import { HttpErrorResponse } from '@angular/common/http';
import { plantName } from '@open-garden/shared-types';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { assertDatePair } from '@open-garden/seasonal-plantings/dates';
import {
  groupPlantings,
  type PlantingGroup,
} from '@open-garden/seasonal-plantings/group-plantings';
import type { FavoriteListItemDto, PlantSummaryDto } from '@open-garden/shared-types';
import { allowsPlant } from '@open-garden/shared-types';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantPicker } from '../plants/plant-picker';
import { PlantingsApiService } from './plantings-api.service';
import { NoticeService } from '../ui/notice.service';
import type { ClientPlanting, ClientPlantingList, QueueItem } from './plantings-offline.queue';
@Component({
  standalone: true,
  imports: [FormsModule, PlantPicker],
  template: `
    <h2>Plantings</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @for (issue of failures(); track issue.key) {
      <p class="needs-attention" role="status">needs-attention: {{ issue.failedMessage }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!list()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (canEdit()) {
        <og-plant-picker
          inputName="plantingSearch"
          searchLabel="Search catalog to add"
          placeholder="Search catalog to add"
          submitLabel="Search catalog"
          (results)="onCatalog($event)"
          (failed)="onSearchFailed($event)"
        >
          <button type="button" class="btn btn-secondary" (click)="loadFavorites()">
            Show favorites
          </button>
        </og-plant-picker>
        @if (manyTrays()) {
          <label>
            Tray
            <select name="startTray" [(ngModel)]="startTrayId">
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
                  (click)="add(p)"
                >
                  Add
                </button>
                @if (hasTrays()) {
                  <button
                    type="button"
                    class="btn btn-secondary"
                    [attr.aria-label]="'Start ' + plantName(p) + ' in a tray'"
                    (click)="startInTray(p)"
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
                  (click)="add(f.plant)"
                >
                  Add
                </button>
              </li>
            }
          </ul>
        }
        <p class="muted">Create beds and change their settings on Plan.</p>
      }
      <div class="filters">
        <label>
          Bed
          <select name="bedFilter" [ngModel]="bedFilter" (ngModelChange)="bedFilter = $event">
            <option value="">All beds</option>
            @for (b of list()!.beds; track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        @if (bedFilter) {
          <button type="button" class="btn btn-secondary" (click)="clearFilter()">Show all</button>
        }
      </div>
      @if (visibleGroups().length === 0 && !list()!.plantings.length && !list()!.beds.length) {
        <p class="muted">
          No plantings yet. Search the catalog or your favorites to record one. Create beds on Plan.
        </p>
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
            @if (group.plantings.length === 0) {
              <p class="muted">No plantings in this bed.</p>
            }
            <div class="card-list">
              @for (p of group.plantings; track p.id) {
                <article
                  class="planting-row"
                  [class.pending-row]="p.sync === 'pending'"
                  [class.needs-attention-row]="p.sync === 'failed'"
                >
                  <div class="row">
                    <div>
                      <strong>{{ plantName(p) }}</strong>
                      <span class="muted"> · {{ p.species }}</span>
                      <p class="chips">
                        @if (p.status !== 'active') {
                          <span class="badge">Unavailable variety</span>
                        }
                        <span class="badge">{{ lifeLabel(p.life) }}</span>
                        @if (p.startMethod === 'transplant') {
                          <span class="badge">{{ inTray(p) ? 'In a tray' : 'Transplant' }}</span>
                        }
                        <span class="badge">{{
                          p.plantedOn ? 'Planted ' + p.plantedOn : 'Not planted'
                        }}</span>
                        @if (p.harvestedOn) {
                          <span class="badge">Harvested {{ p.harvestedOn }}</span>
                        }
                        @if (p.sync === 'pending') {
                          <span class="pending">pending</span>
                        }
                        @if (p.sync === 'failed') {
                          <span class="needs-attention">needs-attention: {{ p.syncMessage }}</span>
                        }
                      </p>
                      @if (showPlantOut(p)) {
                        <label>
                          Plant out
                          <select [attr.name]="'out-' + p.id" (change)="plantOut(p.id, $event)">
                            <option value="">Choose a bed</option>
                            @for (bed of list()!.beds; track bed.id) {
                              <option [value]="bed.id">{{ bed.name }}</option>
                            }
                          </select>
                        </label>
                      }
                    </div>
                    @if (canEdit()) {
                      <button
                        type="button"
                        class="btn btn-secondary"
                        [attr.aria-label]="'Edit ' + plantName(p)"
                        [attr.aria-expanded]="editingId() === p.id"
                        (click)="toggleEdit(p.id)"
                      >
                        {{ editingId() === p.id ? 'Close' : 'Edit' }}
                      </button>
                    }
                  </div>
                  @if (canEdit() && editingId() === p.id) {
                    <div class="planting-editor">
                      <label>
                        Planted
                        <input #plantedInput type="date" [attr.name]="'planted-' + p.id" />
                      </label>
                      <label>
                        Harvest
                        <input #harvestInput type="date" [attr.name]="'harvested-' + p.id" />
                      </label>
                      <label>
                        Bed
                        <select #bedSelect [attr.name]="'bed-' + p.id">
                          <option value="" [selected]="!p.bedId">Unassigned</option>
                          @for (b of list()!.beds; track b.id) {
                            <option [value]="b.id" [selected]="p.bedId === b.id">
                              {{ b.name }}
                            </option>
                          }
                        </select>
                      </label>
                      <label>
                        Note
                        <textarea
                          rows="2"
                          [attr.name]="'note-' + p.id"
                          [ngModel]="noteDraft[p.id] ?? p.note ?? ''"
                          (ngModelChange)="noteDraft[p.id] = $event"
                          [ngModelOptions]="{ standalone: true }"
                        ></textarea>
                      </label>
                      <label>
                        Photo
                        <input type="file" accept="image/*" (change)="onPhoto(p.id, $event)" />
                      </label>
                      @if (photos[p.id] || p.photo) {
                        <img [src]="photos[p.id] || p.photo" alt="" width="96" />
                      }
                      <label>
                        Life
                        <select
                          [attr.name]="'life-' + p.id"
                          [ngModel]="lifeDraft[p.id] ?? p.life ?? 'annual'"
                          (ngModelChange)="lifeDraft[p.id] = $event"
                          [ngModelOptions]="{ standalone: true }"
                        >
                          <option value="annual">Annual</option>
                          <option value="perennial">Perennial</option>
                          <option value="tree">Tree</option>
                        </select>
                      </label>
                      @if ((lifeDraft[p.id] ?? p.life) === 'tree') {
                        <input
                          [attr.name]="'rootstock-' + p.id"
                          placeholder="Rootstock"
                          [ngModel]="rootstockDraft[p.id] ?? p.rootstock ?? ''"
                          (ngModelChange)="rootstockDraft[p.id] = $event"
                          [ngModelOptions]="{ standalone: true }"
                        />
                        <input
                          type="number"
                          min="0"
                          [attr.name]="'years-' + p.id"
                          placeholder="Years to fruit"
                          [ngModel]="yearsDraft[p.id] ?? p.yearsToFruit"
                          (ngModelChange)="yearsDraft[p.id] = $event"
                          [ngModelOptions]="{ standalone: true }"
                        />
                        <input
                          type="number"
                          min="1"
                          [attr.name]="'feet-' + p.id"
                          placeholder="Spacing (ft)"
                          [ngModel]="feetDraft[p.id] ?? p.spacingFeet"
                          (ngModelChange)="feetDraft[p.id] = $event"
                          [ngModelOptions]="{ standalone: true }"
                        />
                      }
                      <div class="filters">
                        <button
                          type="button"
                          class="btn btn-primary"
                          [attr.aria-busy]="notices.busyMap().has('save-planting-' + p.id) || null"
                          [disabled]="notices.busyMap().has('save-planting-' + p.id)"
                          (click)="save(p, plantedInput.value, harvestInput.value, bedSelect.value)"
                        >
                          Save planting
                        </button>
                        <button type="button" class="btn btn-secondary" (click)="sowAgain(p)">
                          Sow again
                        </button>
                        @if (confirmRemoveId() !== p.id) {
                          <button
                            type="button"
                            class="btn btn-secondary"
                            [attr.aria-label]="'Remove ' + plantName(p)"
                            (click)="confirmRemoveId.set(p.id)"
                          >
                            Remove
                          </button>
                        }
                      </div>
                      @if (confirmRemoveId() === p.id) {
                        <p>Permanently remove this planting? This cannot be undone.</p>
                        <div class="filters">
                          <button
                            type="button"
                            class="btn btn-destructive"
                            (click)="confirmRemove(p)"
                          >
                            Confirm remove
                          </button>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            (click)="confirmRemoveId.set(null)"
                          >
                            Cancel
                          </button>
                        </div>
                      }
                    </div>
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
  readonly plantName = plantName;
  private readonly api = inject(PlantingsApiService);
  readonly notices = inject(NoticeService);
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly route = inject(ActivatedRoute);
  gardenId = '';
  list = signal<ClientPlantingList | null>(null);
  loading = signal(true);
  error = signal('');
  confirmRemoveId = signal<string | null>(null);
  /** The planting whose editor is open; one at a time. */
  editingId = signal<string | null>(null);
  failures = signal<QueueItem[]>([]);
  bedFilter = '';
  catalogHits = signal<PlantSummaryDto[]>([]);
  startTrayId = '';

  trays() {
    return this.list()?.trays ?? [];
  }

  inTray(planting: { trayId?: string | null; bedId?: string | null }) {
    return !!planting.trayId && !planting.bedId;
  }

  showPlantOut(planting: { trayId?: string | null; bedId?: string | null }) {
    return this.canEdit() && this.inTray(planting);
  }

  hasTrays() {
    return this.trays().length > 0;
  }

  manyTrays() {
    return this.trays().length > 1;
  }
  noteDraft: Record<string, string> = {};
  photos: Record<string, string> = {};
  lifeDraft: Record<string, 'annual' | 'perennial' | 'tree'> = {};
  rootstockDraft: Record<string, string> = {};
  yearsDraft: Record<string, number | null> = {};
  feetDraft: Record<string, number | null> = {};
  favorites = signal<FavoriteListItemDto[]>([]);
  /** Drops a list response that lost the race with a newer load or edit. */
  private listEpoch = 0;

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
    const epoch = ++this.listEpoch;
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      const list = await this.api.list(this.gardenId);
      if (epoch !== this.listEpoch) return;
      this.list.set(list);
      const tray = list?.trays?.[0];
      if (!this.startTrayId && tray) this.startTrayId = tray.id;
      this.failures.set(await this.api.syncFailures(this.gardenId));
      if (!silent && epoch === this.listEpoch) this.loading.set(false);
      this.syncDateInputs();
    } catch (err) {
      if (epoch === this.listEpoch) this.error.set(messageFrom(err));
    }
    if (!silent && epoch === this.listEpoch) this.loading.set(false);
  }

  onCatalog(items: PlantSummaryDto[]) {
    this.error.set('');
    this.catalogHits.set(items.filter((plant) => allowsPlant('vegetable', plant.plantType)));
  }

  onSearchFailed(err: unknown) {
    this.error.set(messageFrom(err));
  }

  async loadFavorites() {
    this.error.set('');
    const page = await this.favoritesApi.list();
    this.favorites.set(page.items);
  }

  async add(
    plant: Pick<PlantSummaryDto, 'id' | 'commonName' | 'species' | 'cultivar' | 'plantType'> & {
      status?: string;
    },
  ) {
    this.error.set('');
    const epoch = ++this.listEpoch;
    try {
      const created = await this.api.create(
        this.gardenId,
        { plantId: plant.id },
        {
          commonName: plant.commonName,
          species: plant.species,
          cultivar: plant.cultivar,
          plantType: plant.plantType,
          status: plant.status === 'deprecated' ? 'deprecated' : 'active',
        },
      );
      if (epoch !== this.listEpoch) return;
      this.list.set(created);
      this.failures.set(await this.api.syncFailures(this.gardenId));
      this.syncDateInputs();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async startInTray(
    plant: Pick<PlantSummaryDto, 'id' | 'commonName' | 'species' | 'cultivar' | 'plantType'> & {
      status?: string;
    },
  ) {
    const trayId = this.startTrayId || this.list()?.trays?.[0]?.id;
    if (!trayId) return;
    const today = new Date().toISOString().slice(0, 10);
    this.error.set('');
    const epoch = ++this.listEpoch;
    try {
      const created = await this.api.create(
        this.gardenId,
        { plantId: plant.id, startMethod: 'transplant', indoorStartedOn: today, trayId },
        {
          commonName: plant.commonName,
          species: plant.species,
          cultivar: plant.cultivar,
          plantType: plant.plantType,
          status: plant.status === 'deprecated' ? 'deprecated' : 'active',
        },
      );
      if (epoch !== this.listEpoch) return;
      this.list.set(created);
      this.syncDateInputs();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async plantOut(plantingId: string, event: Event) {
    const bedId = (event.target as HTMLSelectElement).value;
    if (!bedId) return;
    this.error.set('');
    try {
      await this.api.update(this.gardenId, plantingId, { bedId, trayId: null });
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  onPhoto(plantingId: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 280_000) {
      this.error.set('Photo must be under 280 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.photos[plantingId] = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  async sowAgain(planting: ClientPlanting) {
    this.error.set('');
    try {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      await this.api.create(this.gardenId, {
        plantId: planting.plantId,
        plantedOn: `${today.getFullYear()}-${month}-${day}`,
        startMethod: planting.startMethod,
        indoorStartedOn:
          planting.startMethod === 'transplant' ? `${today.getFullYear()}-${month}-${day}` : null,
        bedId: planting.bedId,
        life: planting.life ?? 'annual',
      });
      await this.load(true);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  /**
   * One save per planting at a time. A second save started before the first
   * finished could reload the list before the first reached the server, then
   * drop the first's result as stale, leaving a rejected date on screen.
   */
  async save(planting: ClientPlanting, plantedOn: string, harvestedOn: string, bedId: string) {
    await this.notices.run(`save-planting-${planting.id}`, () =>
      this.saveNow(planting, plantedOn, harvestedOn, bedId),
    );
  }

  private async saveNow(
    planting: ClientPlanting,
    plantedOn: string,
    harvestedOn: string,
    bedId: string,
  ) {
    this.error.set('');
    const planted = plantedOn || null;
    const harvested = harvestedOn || null;
    const bed = bedId || null;
    const epoch = ++this.listEpoch;
    try {
      assertDatePair(planted, harvested);
      const life = this.lifeDraft[planting.id] ?? planting.life;
      const saved = await this.api.update(this.gardenId, planting.id, {
        plantedOn: planted,
        harvestedOn: harvested,
        bedId: bed,
        note: this.noteDraft[planting.id] ?? planting.note ?? null,
        photo: this.photos[planting.id] ?? planting.photo ?? null,
        life,
        rootstock: this.rootstockDraft[planting.id] ?? planting.rootstock ?? null,
        yearsToFruit: numberOrNull(this.yearsDraft[planting.id] ?? planting.yearsToFruit),
        spacingFeet: numberOrNull(this.feetDraft[planting.id] ?? planting.spacingFeet),
        plantedYear:
          life === 'tree'
            ? (planting.plantedYear ?? new Date().getFullYear())
            : planting.plantedYear,
      });
      if (epoch !== this.listEpoch) return;
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
      // A focused date keeps the rejected value; blur so the reload restores the last save.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await this.load(true);
    }
  }

  private syncDateInputs() {
    // The date inputs are inside the loaded branch, so they are not in the DOM
    // until the turn after loading flips. A microtask still runs before that.
    setTimeout(() => {
      for (const planting of this.list()?.plantings ?? []) {
        const planted = document.querySelector<HTMLInputElement>(
          `input[name="planted-${planting.id}"]`,
        );
        const harvested = document.querySelector<HTMLInputElement>(
          `input[name="harvested-${planting.id}"]`,
        );
        // A late reload must not wipe a date typed before the model has it.
        if (planted && shouldSyncDate(planted, planting.plantedOn)) {
          planted.value = planting.plantedOn ?? '';
        }
        if (harvested && shouldSyncDate(harvested, planting.harvestedOn)) {
          harvested.value = planting.harvestedOn ?? '';
        }
      }
    });
  }

  toggleEdit(id: string) {
    const opening = this.editingId() !== id;
    this.editingId.set(opening ? id : null);
    this.confirmRemoveId.set(null);
    if (opening) this.syncDateInputs();
  }

  lifeLabel(life: ClientPlanting['life']) {
    return life === 'tree' ? 'Tree' : life === 'perennial' ? 'Perennial' : 'Annual';
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
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shouldSyncDate(input: HTMLInputElement, modelValue: string | null): boolean {
  if (document.activeElement === input) return false;
  const next = modelValue ?? '';
  return Boolean(next) || !input.value;
}

function messageFrom(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Could not update plantings';
}
