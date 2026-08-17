import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { addIsoDateDays, sortReminders } from '@open-garden/care-reminders/derive';
import type { CareKind, ReminderItemDto, ReminderListDto, ReminderUrgency } from '@open-garden/shared-types';

export type ReminderQueueAction = 'complete' | 'dismiss';

export interface ReminderQueueItem {
  key: string;
  gardenId: string;
  plantingId: string;
  kind: CareKind;
  dueOn: string;
  action: ReminderQueueAction;
  intervalDays: number | null;
  updatedAt: number;
  failedMessage?: string;
}

export type ClientReminderItem = ReminderItemDto & {
  sync?: 'pending' | 'failed';
  syncMessage?: string;
};

export type ClientReminderList = Omit<ReminderListDto, 'items'> & {
  items: ClientReminderItem[];
};

interface QueueDb extends DBSchema {
  pending: {
    key: string;
    value: ReminderQueueItem;
  };
}

function urgency(dueOn: string, asOf: string): ReminderUrgency {
  if (dueOn < asOf) return 'overdue';
  if (dueOn === asOf) return 'dueToday';
  return 'upcoming';
}

@Injectable({ providedIn: 'root' })
export class RemindersOfflineQueue {
  private dbPromise: Promise<IDBPDatabase<QueueDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<QueueDb>('og-reminders-queue', 1, {
        upgrade(db) {
          db.createObjectStore('pending', { keyPath: 'key' });
        },
      });
    }
    return this.dbPromise;
  }

  itemKey(plantingId: string, kind: CareKind, dueOn: string) {
    return `${plantingId}:${kind}:${dueOn}`;
  }

  async put(item: ReminderQueueItem) {
    const db = await this.db();
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

  async listForGarden(gardenId: string): Promise<ReminderQueueItem[]> {
    const db = await this.db();
    return (await db.getAll('pending'))
      .filter((item) => item.gardenId === gardenId)
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }

  async dropGarden(gardenId: string) {
    const db = await this.db();
    for (const item of await db.getAll('pending')) {
      if (item.gardenId === gardenId) await db.delete('pending', item.key);
    }
  }

  overlay(list: ReminderListDto, pending: ReminderQueueItem[]): ClientReminderList {
    const suppressed = new Set<string>();
    const extras: ClientReminderItem[] = [];

    for (const q of pending) {
      suppressed.add(q.key);
      const original =
        list.items.find(
          (i) =>
            i.plantingId === q.plantingId && i.kind === q.kind && i.dueOn === q.dueOn,
        ) ?? list.items.find((i) => i.plantingId === q.plantingId && i.kind === q.kind);

      if (q.failedMessage && original) {
        extras.push({
          ...original,
          sync: 'failed',
          syncMessage: q.failedMessage,
        });
        continue;
      }

      if (q.kind !== 'harvest' && q.intervalDays && q.intervalDays > 0 && original) {
        const nextDue = addIsoDateDays(q.dueOn, q.intervalDays);
        extras.push({
          ...original,
          dueOn: nextDue,
          urgency: urgency(nextDue, list.asOf),
          sync: 'pending',
        });
      } else if (original) {
        extras.push({
          ...original,
          sync: 'pending',
        });
      }
    }

    const kept = list.items
      .filter((item) => !suppressed.has(this.itemKey(item.plantingId, item.kind, item.dueOn)))
      .map((item) => ({ ...item }));

    const merged = [...kept];
    for (const extra of extras) {
      const exists = merged.some(
        (i) =>
          i.plantingId === extra.plantingId && i.kind === extra.kind && i.dueOn === extra.dueOn,
      );
      if (!exists) merged.push(extra);
    }

    return {
      ...list,
      items: sortReminders(merged),
    };
  }
}
