import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { evaluateLayout } from '@open-garden/garden-layout/evaluate';
import type { GardenLayoutDto, LayoutFlagDto, LayoutPutDto } from '@open-garden/shared-types';
import {
  hasLayoutChanges,
  layoutChanges,
  layoutPutBody,
  placementNotes,
  restoreLayout,
} from '@open-garden/garden-layout';
import { OnlineRequiredError } from './gardens-api.service';
import { LayoutApiService } from './layout-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { freshLayoutApplies, mergeWaitingTransplants, savePlannerDraft } from './planner-save';
import { apiMessage } from '../ui/error-message';

/** Where the plan's autosave stands, for the status line. */
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'failed' | 'blocked';

/** How many edits Undo can step back through. */
const UNDO_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class PlannerDraftService {
  private readonly api = inject(LayoutApiService);
  private readonly plantingsApi = inject(PlantingsApiService);
  private readonly zone = inject(NgZone);

  readonly draft = signal<GardenLayoutDto | null>(null);
  readonly flags = signal<LayoutFlagDto[]>([]);
  readonly loading = signal(true);
  readonly status = signal<SaveStatus>('saved');
  /** Why the last save did not happen, when status is failed or blocked. */
  readonly statusMessage = signal('');
  private readonly history = signal<GardenLayoutDto[]>([]);
  readonly canUndo = computed(() => this.history().length > 0);
  gardenId = '';
  /** The season shown when it is the next one (ADR 0040); null is the current season. */
  readonly season = signal<number | null>(null);
  /** Quiet time after an edit before it is saved; edits inside it are one undo step. */
  autosaveDelayMs = 800;
  /**
   * The layout as last loaded or saved. A save sends the difference between
   * it and the draft; problems it already had do not block.
   */
  private saved: GardenLayoutDto | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** True between the first edit of a burst and its save, so the burst is one undo step. */
  private burstOpen = false;
  private running: Promise<void> | null = null;
  private again = false;

  hydrate(layout: GardenLayoutDto) {
    this.cancelTimer();
    const next = { ...layout, areas: layout.areas ?? [] };
    this.draft.set(next);
    this.saved = next;
    this.history.set([]);
    this.status.set('saved');
    this.statusMessage.set('');
    this.flags.set(layoutFlags(next, next));
  }

  /** Whether the server has this bed yet (it may be drawn but not saved). */
  isSavedBed(bedId: string): boolean {
    return this.saved?.beds.some((b) => b.id === bedId) ?? false;
  }

  /** Whether the server has this walkway yet. */
  isSavedArea(areaId: string): boolean {
    return this.saved?.areas.some((a) => a.id === areaId) ?? false;
  }

  /**
   * Shows the next season's plan, or the current one with null (ADR 0040),
   * after saving pending edits to the plan shown now.
   */
  async setSeason(year: number | null): Promise<void> {
    const d = this.draft();
    const next = year === d?.currentSeasonYear ? null : year;
    if (next === this.season()) return;
    await this.flush();
    this.season.set(next);
    this.saved = null;
    this.draft.set(null);
    this.history.set([]);
    await this.load(this.gardenId);
  }

  async load(gardenId: string, opts?: { reuseDirty?: boolean }): Promise<GardenLayoutDto | null> {
    if (opts?.reuseDirty && this.gardenId === gardenId && this.draft() && this.dirty()) {
      this.loading.set(false);
      return this.draft();
    }
    // Another property opens on its current season.
    if (gardenId !== this.gardenId) this.season.set(null);
    this.gardenId = gardenId;
    const season = this.season();
    const cached = season ? null : await this.api.peek(gardenId);
    if (cached) {
      this.hydrate(cached);
      this.loading.set(false);
    } else {
      this.loading.set(true);
    }
    const shown = this.draft();
    const layout = await this.api.get(gardenId, season);
    if (!layout) {
      this.draft.set(null);
      this.loading.set(false);
      return null;
    }
    if (freshLayoutApplies(shown, this.draft(), this.dirty())) this.hydrate(layout);
    this.loading.set(false);
    return this.draft();
  }

  dirty(): boolean {
    const d = this.draft();
    return !!d && !!this.saved && hasLayoutChanges(layoutChanges(this.saved, d));
  }

  /** Edits that have not reached the server: waiting, saving, or refused. */
  unsaved(): boolean {
    return this.status() !== 'saved' || this.dirty();
  }

  putBody(d: GardenLayoutDto): LayoutPutDto {
    return layoutPutBody(d);
  }

  refreshFlags() {
    const d = this.draft();
    this.flags.set(d ? layoutFlags(d, this.saved) : []);
  }

  /** Replaces the draft without recording an edit (data brought in, not a change made here). */
  setDraft(next: GardenLayoutDto) {
    this.draft.set({ ...next, areas: next.areas ?? [] });
  }

  /** A change the member made to the plan: it can be undone and is saved shortly. */
  edit(next: GardenLayoutDto) {
    const current = this.draft();
    if (current && !this.burstOpen) {
      this.history.update((h) => [...h, current].slice(-UNDO_LIMIT));
      this.burstOpen = true;
    }
    this.setDraft(next);
    this.refreshFlags();
    this.schedule();
  }

  /** Steps back one edit (or one burst of quick edits) and saves that. */
  undo() {
    const history = this.history();
    const current = this.draft();
    const earlier = history.at(-1);
    if (!earlier || !current) return;
    this.history.set(history.slice(0, -1));
    this.burstOpen = false;
    this.setDraft(restoreLayout(current, earlier));
    this.refreshFlags();
    this.schedule();
  }

  /**
   * Something changed on the server outright (a confirmed delete, a planting
   * marked planted): apply it to the saved layout and the draft alike. Undo
   * does not reach past it.
   */
  applyServerChange(change: (layout: GardenLayoutDto) => GardenLayoutDto) {
    if (this.saved) this.saved = change(this.saved);
    const d = this.draft();
    if (d) this.setDraft(change(d));
    this.history.set([]);
    this.burstOpen = false;
    this.refreshFlags();
  }

  /**
   * Removes a saved direct-sown plant on the server straight away (the member
   * confirmed it), after saving pending edits. Undo does not reach past it.
   */
  async deletePlantingNow(plantingId: string): Promise<void> {
    await this.flush();
    await this.plantingsApi.remove(this.gardenId, plantingId);
    this.applyServerChange((l) => ({
      ...l,
      plantings: l.plantings.filter((p) => p.id !== plantingId),
    }));
  }

  /**
   * Marks a planting planted on a day (ADR 0040), after saving pending edits
   * so a planting placed a moment ago exists on the server.
   */
  async markPlantedNow(plantingId: string, plantedOn: string): Promise<void> {
    await this.flush();
    await this.plantingsApi.update(this.gardenId, plantingId, { plantedOn });
    this.applyServerChange((l) => ({
      ...l,
      plantings: l.plantings.map((p) => (p.id === plantingId ? { ...p, plantedOn } : p)),
    }));
  }

  /** Whether the server has this planting yet. */
  isSavedPlanting(plantingId: string): boolean {
    return this.saved?.plantings.some((p) => p.id === plantingId) ?? false;
  }

  /** Saves pending edits now, for example before leaving or a confirmed delete. */
  async flush(): Promise<void> {
    this.cancelTimer();
    this.burstOpen = false;
    if (this.running) {
      this.again = true;
      await this.running;
      return;
    }
    this.running = this.saveLoop().finally(() => (this.running = null));
    await this.running;
  }

  /** Tries the last refused save again. */
  retry(): Promise<void> {
    return this.flush();
  }

  /**
   * Waiting transplants are written on the Transplants page (immediate POST),
   * not in the layout draft. Pull them into the in-memory tray so Bed View can
   * place them even when the draft was kept across that navigation.
   */
  async syncWaitingTransplants(): Promise<void> {
    const d = this.draft();
    if (!d || !this.gardenId) return;
    const list = await this.api.getTransplants(this.gardenId);
    if (!list) return;
    const next = mergeWaitingTransplants(d.plantings, list.plantings);
    if (next === d.plantings) return;
    this.setDraft({ ...d, plantings: next });
    this.refreshFlags();
  }

  discard() {
    this.cancelTimer();
    this.gardenId = '';
    this.draft.set(null);
    this.saved = null;
    this.history.set([]);
    this.status.set('saved');
    this.flags.set([]);
  }

  private schedule() {
    this.cancelTimer();
    this.status.set('pending');
    // Outside Angular's zone: a waiting autosave is not unfinished work.
    this.timer = this.zone.runOutsideAngular(() =>
      setTimeout(() => this.zone.run(() => void this.flush()), this.autosaveDelayMs),
    );
  }

  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One save at a time; edits made during a save go in the next one. */
  private async saveLoop() {
    do {
      this.again = false;
      await this.saveOnce();
    } while (this.again && this.status() !== 'failed' && this.status() !== 'blocked');
  }

  private async saveOnce() {
    const sent = this.draft();
    const saved = this.saved;
    if (!sent || !saved || !hasLayoutChanges(layoutChanges(saved, sent))) {
      this.status.set('saved');
      this.statusMessage.set('');
      return;
    }
    this.status.set('saving');
    try {
      const result = await savePlannerDraft(sent, saved, {
        createBed: (body) => this.api.createBed(this.gardenId, body),
        deleteBed: (id) => this.api.deleteBed(this.gardenId, id),
        createPlanting: (body) =>
          this.plantingsApi
            .create(this.gardenId, { ...body, seasonYear: this.season() ?? undefined })
            .then(() => undefined),
        deletePlanting: (id) => this.plantingsApi.remove(this.gardenId, id),
        putLayout: (body) => this.api.put(this.gardenId, body, this.season()),
      });
      this.saved = result;
      // Keep edits made while saving; otherwise show what the server stored.
      if (this.draft() === sent) this.setDraft(this.saved);
      this.refreshFlags();
      const more = this.dirty();
      this.status.set(more ? 'pending' : 'saved');
      this.statusMessage.set('');
      if (more) this.again = true;
    } catch (err) {
      const blocked = (err as { code?: string }).code === 'SPACING';
      this.status.set(blocked ? 'blocked' : 'failed');
      this.statusMessage.set(blocked ? 'Too close, or past a bed edge' : saveError(err));
    }
  }
}

function layoutFlags(layout: GardenLayoutDto, saved: GardenLayoutDto | null) {
  return [
    ...evaluateLayout(layout.beds, layout.plantings, saved ?? undefined),
    ...placementNotes(layout),
  ];
}

function saveError(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'You are offline';
  }
  return apiMessage(err) ?? 'Could not save the plan';
}
