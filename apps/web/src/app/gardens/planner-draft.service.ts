import { Injectable, inject, signal } from '@angular/core';
import { evaluateLayout } from '@open-garden/garden-layout/evaluate';
import type { GardenLayoutDto, LayoutFlagDto, LayoutPutDto } from '@open-garden/shared-types';
import { LayoutApiService } from './layout-api.service';
import { PlantingsApiService } from './plantings-api.service';
import {
  draftIsDirty,
  putBodyFromDraft,
  savePlannerDraft,
  type PlannerSaveTracking,
} from './planner-save';

@Injectable({ providedIn: 'root' })
export class PlannerDraftService {
  private readonly api = inject(LayoutApiService);
  private readonly plantingsApi = inject(PlantingsApiService);

  readonly draft = signal<GardenLayoutDto | null>(null);
  readonly flags = signal<LayoutFlagDto[]>([]);
  readonly loading = signal(true);
  gardenId = '';
  newBedIds = new Set<string>();
  newDirectSeedIds = new Set<string>();
  pendingDirectSeedDeletes = new Set<string>();
  savedPutJson = '';

  tracking(): PlannerSaveTracking {
    return {
      newBedIds: this.newBedIds,
      newDirectSeedIds: this.newDirectSeedIds,
      pendingDirectSeedDeletes: this.pendingDirectSeedDeletes,
    };
  }

  hydrate(layout: GardenLayoutDto) {
    const next = { ...layout, areas: layout.areas ?? [] };
    this.draft.set(next);
    this.newBedIds.clear();
    this.newDirectSeedIds.clear();
    this.pendingDirectSeedDeletes.clear();
    this.savedPutJson = JSON.stringify(putBodyFromDraft(next));
    this.flags.set(evaluateLayout(next.beds, next.plantings));
  }

  async load(gardenId: string, opts?: { reuseDirty?: boolean }): Promise<GardenLayoutDto | null> {
    if (opts?.reuseDirty && this.gardenId === gardenId && this.draft() && this.dirty()) {
      this.loading.set(false);
      return this.draft();
    }
    this.gardenId = gardenId;
    this.loading.set(true);
    const layout = await this.api.get(gardenId);
    if (!layout) {
      this.draft.set(null);
      this.loading.set(false);
      return null;
    }
    this.hydrate(layout);
    this.loading.set(false);
    return layout;
  }

  dirty(): boolean {
    return draftIsDirty(this.draft(), this.savedPutJson, this.tracking());
  }

  putBody(d: GardenLayoutDto): LayoutPutDto {
    return putBodyFromDraft(d);
  }

  refreshFlags() {
    const d = this.draft();
    this.flags.set(d ? evaluateLayout(d.beds, d.plantings) : []);
  }

  setDraft(next: GardenLayoutDto) {
    this.draft.set({ ...next, areas: next.areas ?? [] });
  }

  discard() {
    this.gardenId = '';
    this.draft.set(null);
    this.newBedIds.clear();
    this.newDirectSeedIds.clear();
    this.pendingDirectSeedDeletes.clear();
    this.savedPutJson = '';
    this.flags.set([]);
  }

  async save(): Promise<GardenLayoutDto> {
    const d = this.draft();
    if (!d) throw new Error('No draft');
    const saved = await savePlannerDraft(d, this.tracking(), {
      createBed: (body) => this.api.createBed(this.gardenId, body),
      deleteBed: (id) => this.api.deleteBed(this.gardenId, id),
      createPlanting: (body) => this.plantingsApi.create(this.gardenId, body).then(() => undefined),
      deletePlanting: (id) => this.plantingsApi.remove(this.gardenId, id),
      putLayout: (body) => this.api.put(this.gardenId, body),
    });
    this.hydrate(saved);
    return saved;
  }
}
