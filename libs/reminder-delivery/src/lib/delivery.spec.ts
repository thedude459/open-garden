import type { TodayDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { ReminderDelivery, type Channel, type DeliveryStore, type Recipient } from './delivery';

const due: TodayDto = {
  tasks: [
    { gardenId: 'g', gardenName: 'Home', kind: 'dueToday', title: 'Water Basil', bedName: null },
  ],
  gardens: [],
};

function memoryStore(recipients: Recipient[]) {
  const claimed = new Set<string>();
  const removed: string[] = [];
  const store: DeliveryStore = {
    recipients: async () => recipients,
    claim: async (userId: string, channel: Channel, day: string) => {
      const key = `${userId}:${channel}:${day}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    release: async (userId: string, channel: Channel, day: string) => {
      claimed.delete(`${userId}:${channel}:${day}`);
    },
    removePush: async (endpoint: string) => {
      removed.push(endpoint);
    },
  };
  return { store, claimed, removed };
}

const device = (endpoint: string) => ({ endpoint, p256dh: 'k', auth: 'a' });
const ann: Recipient = {
  userId: 'ann',
  email: 'ann@example.com',
  emailDigest: true,
  push: [device('phone'), device('laptop')],
};

describe('ReminderDelivery', () => {
  it('sends one push and one email a day, and drops a device the browser has dropped', async () => {
    const { store, removed } = memoryStore([ann]);
    const pushed: string[] = [];
    const mailed: string[] = [];
    const delivery = new ReminderDelivery(store, async () => due, {
      push: {
        send: async (sub) => {
          pushed.push(sub.endpoint);
          return sub.endpoint === 'laptop' ? 'gone' : 'sent';
        },
      },
      email: { send: async (to, subject) => void mailed.push(`${to}: ${subject}`) },
    });
    expect(await delivery.run('2026-06-01')).toEqual({ push: 1, email: 1 });
    expect(pushed).toEqual(['phone', 'laptop']);
    expect(removed).toEqual(['laptop']);
    expect(mailed).toEqual(['ann@example.com: Open Garden: 1 task today']);
    // A second run the same day sends nothing; the next day sends again.
    expect(await delivery.run('2026-06-01')).toEqual({ push: 0, email: 0 });
    expect(await delivery.run('2026-06-02')).toEqual({ push: 1, email: 1 });
  });

  it('gives the day back after a failed send, so a later run retries', async () => {
    const { store, claimed } = memoryStore([ann]);
    let fail = true;
    const delivery = new ReminderDelivery(store, async () => due, {
      push: {
        send: async () => {
          if (fail) throw new Error('offline');
          return 'sent';
        },
      },
      email: {
        send: async () => {
          if (fail) throw new Error('smtp down');
        },
      },
    });
    expect(await delivery.run('2026-06-01')).toEqual({ push: 0, email: 0 });
    expect(claimed.size).toBe(0);
    fail = false;
    expect(await delivery.run('2026-06-01')).toEqual({ push: 1, email: 1 });
  });

  it('skips channels without a sender, members without a channel, and days with nothing due', async () => {
    const quiet: Recipient = {
      userId: 'bo',
      email: 'bo@example.com',
      emailDigest: false,
      push: [],
    };
    const { store, claimed } = memoryStore([ann, quiet]);
    let asked = 0;
    const emailOnly = new ReminderDelivery(
      store,
      async (userId) => {
        asked += 1;
        if (userId === 'bo') throw new Error('should not be asked');
        return { tasks: [], gardens: [] };
      },
      { email: { send: async () => undefined } },
      'https://garden.example',
    );
    expect(await emailOnly.run('2026-06-01')).toEqual({ push: 0, email: 0 });
    expect(asked).toBe(1);
    expect(claimed.size).toBe(0);
  });

  it('carries on when one member’s tasks cannot be read', async () => {
    const other: Recipient = { ...ann, userId: 'cy' };
    const { store } = memoryStore([ann, other]);
    const delivery = new ReminderDelivery(
      store,
      async (userId) => {
        if (userId === 'ann') throw new Error('db hiccup');
        return due;
      },
      { email: { send: async () => undefined } },
    );
    expect(await delivery.run('2026-06-01')).toEqual({ push: 0, email: 1 });
  });
});
