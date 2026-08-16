import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BedCreateDto, NamedBedDto, PlantingCreateDto, PlantingDto, PlantingListDto, PlantingPatchDto } from '@open-garden/shared-types';

export type QueueOp = 'create' | 'update' | 'delete';

export interface PlantingPreview {
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantingDto['plantType'];
  status?: PlantingDto['status'];
}

export interface QueueItem {
  key: string;
  kind: 'planting' | 'bed';
  gardenId: string;
  op: QueueOp;
  body?: PlantingCreateDto | PlantingPatchDto | BedCreateDto | { name: string };
  preview?: PlantingPreview;
  clientMutationId: string;
  updatedAt: number;
  failedMessage?: string;
}

interface QueueDb extends DBSchema {
  pending: {
    key: string;
    value: QueueItem;
  };
}

export type ClientPlanting = PlantingDto & { sync?: 'pending' | 'failed'; syncMessage?: string };
export type ClientBed = NamedBedDto & { sync?: 'pending' | 'failed'; syncMessage?: string };
export type ClientPlantingList = Omit<PlantingListDto, 'plantings' | 'beds'> & {
  plantings: ClientPlanting[];
  beds: ClientBed[];
};

@Injectable({ providedIn: 'root' })
export class PlantingsOfflineQueue {
  private dbPromise: Promise<IDBPDatabase<QueueDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<QueueDb>('og-plantings-queue', 1, {
        upgrade(db) {
          db.createObjectStore('pending', { keyPath: 'key' });
        },
      });
    }
    return this.dbPromise;
  }

  entityKey(kind: 'planting' | 'bed', id: string) {
    return `${kind}:${id}`;
  }

  async put(item: QueueItem) {
    const db = await this.db();
    const existing = await db.get('pending', item.key);
    if (existing?.op === 'create' && item.op === 'delete' && existing.kind === item.kind) {
      await db.delete('pending', item.key);
      return;
    }
    await db.put('pending', { ...item, failedMessage: undefined });
  }

  async markFailed(key: string, message: string) {
    const db = await this.db();
    const existing = await db.get('pending', key);
    if (!existing) return;
    await db.put('pending', { ...existing, failedMessage: message });
  }

  async delete(key: string) {
    const db = await this.db();
    await db.delete('pending', key);
  }

  async listForGarden(gardenId: string): Promise<QueueItem[]> {
    const db = await this.db();
    return (await db.getAll('pending'))
      .filter((item) => item.gardenId === gardenId)
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }

  async dropGarden(gardenId: string) {
    const db = await this.db();
    const all = await db.getAll('pending');
    for (const item of all) {
      if (item.gardenId === gardenId) await db.delete('pending', item.key);
    }
  }

  overlay(list: PlantingListDto, pending: QueueItem[]): ClientPlantingList {
    const plantings = new Map<string, ClientPlanting>(
      list.plantings.map((p) => [p.id, { ...p }]),
    );
    const beds = new Map<string, ClientBed>(list.beds.map((b) => [b.id, { ...b }]));
    for (const item of pending) {
      if (item.kind === 'planting') {
        const id = item.key.slice('planting:'.length);
        if (item.op === 'delete') {
          plantings.delete(id);
          continue;
        }
        if (item.op === 'create' && item.body && 'plantId' in item.body) {
          const body = item.body as PlantingCreateDto;
          const existing = plantings.get(id);
          plantings.set(id, {
            id,
            plantId: body.plantId,
            commonName: existing?.commonName ?? item.preview?.commonName ?? 'Pending planting',
            species: existing?.species ?? item.preview?.species ?? '',
            cultivar: existing?.cultivar ?? item.preview?.cultivar ?? null,
            plantType: existing?.plantType ?? item.preview?.plantType ?? 'vegetable',
            status: existing?.status ?? item.preview?.status ?? 'active',
            plantedOn: body.plantedOn ?? existing?.plantedOn ?? null,
            harvestedOn: body.harvestedOn ?? existing?.harvestedOn ?? null,
            bedId: body.bedId ?? existing?.bedId ?? null,
            createdAt: existing?.createdAt ?? new Date(item.updatedAt).toISOString(),
            updatedAt: new Date(item.updatedAt).toISOString(),
            sync: item.failedMessage ? 'failed' : 'pending',
            syncMessage: item.failedMessage,
          });
          continue;
        }
        const current = plantings.get(id);
        if (current && item.body && !('plantId' in item.body) && !('name' in item.body)) {
          const patch = item.body as PlantingPatchDto;
          plantings.set(id, {
            ...current,
            plantedOn: patch.plantedOn !== undefined ? patch.plantedOn : current.plantedOn,
            harvestedOn: patch.harvestedOn !== undefined ? patch.harvestedOn : current.harvestedOn,
            bedId: patch.bedId !== undefined ? patch.bedId : current.bedId,
            sync: item.failedMessage ? 'failed' : 'pending',
            syncMessage: item.failedMessage,
          });
        }
      } else {
        const id = item.key.slice('bed:'.length);
        if (item.op === 'delete') {
          beds.delete(id);
          for (const planting of plantings.values()) {
            if (planting.bedId === id) planting.bedId = null;
          }
          continue;
        }
        const name =
          item.body && 'name' in item.body ? String((item.body as { name: string }).name) : 'Bed';
        const existing = beds.get(id);
        beds.set(id, {
          id,
          name,
          createdAt: existing?.createdAt ?? new Date(item.updatedAt).toISOString(),
          updatedAt: new Date(item.updatedAt).toISOString(),
          sync: item.failedMessage ? 'failed' : 'pending',
          syncMessage: item.failedMessage,
        });
      }
    }
    return {
      ...list,
      beds: [...beds.values()],
      plantings: [...plantings.values()].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
    };
  }
}
