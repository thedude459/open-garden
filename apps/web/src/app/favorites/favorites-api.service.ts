import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FavoriteListItemDto, PageDto } from '@open-garden/shared-types';

const API = 'http://localhost:3000/api';

interface FavDb extends DBSchema {
  pending: {
    key: string;
    value: {
      plantId: string;
      op: 'add' | 'remove';
      clientMutationId: string;
      updatedAt: number;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  private readonly http = inject(HttpClient);
  private dbPromise: Promise<IDBPDatabase<FavDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FavDb>('og-favorites', 1, {
        upgrade(db) {
          db.createObjectStore('pending', { keyPath: 'plantId' });
        },
      });
    }
    return this.dbPromise;
  }

  async list(): Promise<PageDto<FavoriteListItemDto>> {
    try {
      await this.drain();
      return await firstValueFrom(
        this.http.get<PageDto<FavoriteListItemDto>>(`${API}/favorites`, {
          withCredentials: true,
        }),
      );
    } catch {
      return { items: [], page: 1, pageSize: 20, totalCount: 0 };
    }
  }

  /** @returns true if queued offline */
  async add(plantId: string): Promise<boolean> {
    const clientMutationId = crypto.randomUUID();
    try {
      await firstValueFrom(
        this.http.put(
          `${API}/favorites/${plantId}`,
          { clientMutationId },
          { withCredentials: true },
        ),
      );
      return false;
    } catch {
      const db = await this.db();
      await db.put('pending', {
        plantId,
        op: 'add',
        clientMutationId,
        updatedAt: Date.now(),
      });
      return true;
    }
  }

  async remove(plantId: string): Promise<boolean> {
    const clientMutationId = crypto.randomUUID();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/favorites/${plantId}`, { withCredentials: true }),
      );
      return false;
    } catch {
      const db = await this.db();
      await db.put('pending', {
        plantId,
        op: 'remove',
        clientMutationId,
        updatedAt: Date.now(),
      });
      return true;
    }
  }

  async drain() {
    if (!navigator.onLine) return;
    const db = await this.db();
    const pending = await db.getAll('pending');
    for (const item of pending) {
      try {
        if (item.op === 'add') {
          await firstValueFrom(
            this.http.put(
              `${API}/favorites/${item.plantId}`,
              { clientMutationId: item.clientMutationId },
              { withCredentials: true },
            ),
          );
        } else {
          await firstValueFrom(
            this.http.delete(`${API}/favorites/${item.plantId}`, { withCredentials: true }),
          );
        }
        await db.delete('pending', item.plantId);
      } catch {
        // leave pending
      }
    }
  }
}
