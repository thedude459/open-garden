import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { assertDatePair } from '@open-garden/seasonal-plantings/dates';
import {
  groupPlantings,
  type PlantingGroup,
} from '@open-garden/seasonal-plantings/group-plantings';
import {
  plantName,
  type PlantingCreateDto,
  type PlantingDto,
  type PlantingPatchDto,
  type PlantingRepeatResultDto,
} from '@open-garden/shared-types';
import { formatDay } from '@open-garden/web-ui';
import { NoticeService } from '../ui/notice.service';
import { PlantingAddSection, type PlantToAdd } from './planting-add.section';
import { PlantingEditor } from './planting-editor';
import { PlantingsApiService } from './plantings-api.service';
import { SeasonPicker } from './season-picker';
import type { ClientPlanting, ClientPlantingList, QueueItem } from './plantings-offline.queue';

@Component({
  standalone: true,
  imports: [FormsModule, PlantingAddSection, PlantingEditor, SeasonPicker],
  template: `
    <h2>Plantings</h2>
    @if (list()?.currentSeasonYear; as current) {
      <og-season-picker
        [current]="current"
        [shown]="list()!.seasonYear ?? current"
        (picked)="pickSeason($event)"
      />
    }
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
        <og-planting-add
          [trays]="trays()"
          (add)="add($event)"
          (startInTray)="startInTray($event.plant, $event.trayId)"
        />
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
                          p.plantedOn
                            ? 'Planted ' + formatDay(p.plantedOn)
                            : p.plannedOn
                              ? 'Planned for ' + formatDay(p.plannedOn)
                              : 'Planned'
                        }}</span>
                        @if (p.harvestedOn) {
                          <span class="badge">Harvested {{ formatDay(p.harvestedOn) }}</span>
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
                    <og-planting-editor
                      [planting]="p"
                      [beds]="list()!.beds"
                      [saving]="notices.busyMap().has('save-planting-' + p.id)"
                      (save)="save(p, $event)"
                      (sowAgain)="sowAgain(p)"
                      [repeatBusy]="notices.busyMap().has('repeat-planting-' + p.id)"
                      (repeat)="repeat(p, $event)"
                      [suggestedUntil]="repeatUntil()[p.id] ?? null"
                      (repeatOpened)="loadRepeatPlan(p)"
                      [harvestBusy]="notices.busyMap().has('harvest-' + p.id)"
                      (logHarvest)="logHarvest(p, $event)"
                      (deleteHarvest)="deleteHarvest(p, $event)"
                      (remove)="confirmRemove(p)"
                      (failed)="error.set($event)"
                    />
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
  readonly formatDay = formatDay;
  private readonly route = inject(ActivatedRoute);
  gardenId = '';
  list = signal<ClientPlantingList | null>(null);
  /** The next season, when it is the one shown (ADR 0040); null is the current one. */
  readonly season = signal<number | null>(null);
  loading = signal(true);
  error = signal('');
  /** The planting whose editor is open; one at a time. */
  editingId = signal<string | null>(null);
  failures = signal<QueueItem[]>([]);
  bedFilter = '';
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

  trays() {
    return this.list()?.trays ?? [];
  }

  inTray(planting: { trayId?: string | null; bedId?: string | null }) {
    return !!planting.trayId && !planting.bedId;
  }

  showPlantOut(planting: { trayId?: string | null; bedId?: string | null }) {
    return this.canEdit() && this.inTray(planting);
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
      const list = await this.api.list(this.gardenId, this.season());
      if (epoch !== this.listEpoch) return;
      this.list.set(list);
      this.failures.set(await this.api.syncFailures(this.gardenId));
    } catch (err) {
      if (epoch === this.listEpoch) this.error.set(messageFrom(err));
    }
    if (!silent && epoch === this.listEpoch) this.loading.set(false);
  }

  /** Lists the next season, to plan it, or this one again. */
  async pickSeason(year: number) {
    this.season.set(year === this.list()?.currentSeasonYear ? null : year);
    await this.load();
  }

  add(plant: PlantToAdd) {
    return this.create(plant, { plantId: plant.id });
  }

  startInTray(plant: PlantToAdd, trayId: string) {
    const today = new Date().toISOString().slice(0, 10);
    return this.create(plant, {
      plantId: plant.id,
      startMethod: 'transplant',
      indoorStartedOn: today,
      trayId,
    });
  }

  private async create(plant: PlantToAdd, body: PlantingCreateDto) {
    this.error.set('');
    const epoch = ++this.listEpoch;
    try {
      const created = await this.api.create(
        this.gardenId,
        // Added while the next season is shown, it belongs to that season.
        { ...body, seasonYear: this.season() ?? undefined },
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

  async logHarvest(
    planting: ClientPlanting,
    body: { harvestedOn: string; grams: number | null; count: number | null },
  ) {
    this.error.set('');
    await this.notices.run(`harvest-${planting.id}`, async () => {
      try {
        this.replace(await this.api.logHarvest(this.gardenId, planting.id, body));
        this.notices.success(`Harvest of ${plantName(planting)} saved.`);
      } catch (err) {
        this.error.set(messageFrom(err));
      }
    });
  }

  async deleteHarvest(planting: ClientPlanting, harvestedOn: string) {
    this.error.set('');
    await this.notices.run(`harvest-${planting.id}`, async () => {
      try {
        this.replace(await this.api.deleteHarvest(this.gardenId, planting.id, harvestedOn));
      } catch (err) {
        this.error.set(messageFrom(err));
      }
    });
  }

  /** Put a saved planting in place of its row. */
  private replace(saved: PlantingDto) {
    const list = this.list();
    if (!list) return;
    this.list.set({
      ...list,
      plantings: list.plantings.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)),
    });
  }

  /** Suggested series ends by planting: the last sowing that ripens before frost. */
  readonly repeatUntil = signal<Record<string, string | null>>({});

  async loadRepeatPlan(planting: ClientPlanting) {
    const last = await this.api.repeatPlan(this.gardenId, planting.id);
    this.repeatUntil.update((all) => ({ ...all, [planting.id]: last }));
  }

  async repeat(planting: ClientPlanting, body: { everyWeeks: number; until: string }) {
    this.error.set('');
    await this.notices.run(`repeat-planting-${planting.id}`, async () => {
      try {
        const result = await this.api.repeat(this.gardenId, planting.id, body);
        await this.load(true);
        this.notices.success(repeatMessage(plantName(planting), result));
      } catch (err) {
        this.error.set(messageFrom(err));
      }
    });
  }

  /**
   * One save per planting at a time. A second save started before the first
   * finished could reload the list before the first reached the server, then
   * drop the first's result as stale, leaving a rejected date on screen.
   */
  async save(planting: ClientPlanting, patch: PlantingPatchDto) {
    await this.notices.run(`save-planting-${planting.id}`, () => this.saveNow(planting, patch));
  }

  private async saveNow(planting: ClientPlanting, patch: PlantingPatchDto) {
    this.error.set('');
    const epoch = ++this.listEpoch;
    try {
      assertDatePair(patch.plantedOn ?? null, patch.harvestedOn ?? null);
      const saved = await this.api.update(this.gardenId, planting.id, patch);
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

  toggleEdit(id: string) {
    this.editingId.set(this.editingId() === id ? null : id);
  }

  lifeLabel(life: ClientPlanting['life']) {
    return life === 'tree' ? 'Tree' : life === 'perennial' ? 'Perennial' : 'Annual';
  }

  async confirmRemove(planting: ClientPlanting) {
    this.error.set('');
    try {
      await this.api.remove(this.gardenId, planting.id);
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

/** What a succession series did, in one line for the notice. */
export function repeatMessage(
  name: string,
  result: Pick<PlantingRepeatResultDto, 'added' | 'outOfWindow' | 'tooLate'>,
): string {
  const sowings = (n: number) => `${n} sowing${n === 1 ? '' : 's'}`;
  const left: string[] = [];
  if (result.outOfWindow) left.push(`${sowings(result.outOfWindow)} outside its sowing windows`);
  if (result.tooLate) left.push(`${sowings(result.tooLate)} too late to ripen before frost`);
  const rest = left.length ? ` Left out ${left.join(' and ')}.` : '';
  return `Added ${sowings(result.added)} of ${name}.${rest}`;
}
