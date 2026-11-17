// Reminders online, offline, and back: the queue that keeps a member's
// completed chores when the network drops, and the cached list behind it.
// IndexedDB is not in the test browser, so the queue and cache keep their
// rows in memory here; their thin idb wrappers are covered by the offline
// Playwright tests.
import { afterEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ReminderItemDto, ReminderListDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenRemindersCacheService, rainForDeviceDay } from './garden-reminders-cache.service';
import { RemindersApiService, RemindersColdOfflineError } from './reminders-api.service';
import { RemindersOfflineQueue, type ReminderQueueItem } from './reminders-offline.queue';

const TODAY = '2026-06-10';

const item = (over: Partial<ReminderItemDto> = {}): ReminderItemDto => ({
  plantingId: 'p1',
  kind: 'water',
  dueOn: '2026-06-09',
  urgency: 'overdue',
  intervalDays: 3,
  plantId: 'tomato',
  commonName: 'Tomato',
  species: 'Solanum lycopersicum',
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  required: true,
  rainNote: null,
  ...over,
});

const list = (items: ReminderItemDto[], over: Partial<ReminderListDto> = {}): ReminderListDto => ({
  gardenId: 'g1',
  asOf: TODAY,
  myRole: 'owner',
  items,
  outlookOn: null,
  ...over,
});

/** The real queue's overlay over rows kept in memory. */
class MemoryQueue extends RemindersOfflineQueue {
  readonly rows = new Map<string, ReminderQueueItem>();
  override async put(row: ReminderQueueItem) {
    this.rows.set(row.key, { ...row, failedMessage: undefined });
  }
  override async markFailed(key: string, message: string) {
    const row = this.rows.get(key);
    if (row) this.rows.set(key, { ...row, failedMessage: message });
  }
  override async delete(key: string) {
    this.rows.delete(key);
  }
  override async listForGarden(gardenId: string) {
    return [...this.rows.values()].filter((r) => r.gardenId === gardenId);
  }
  override async dropGarden(gardenId: string) {
    for (const [key, row] of this.rows) if (row.gardenId === gardenId) this.rows.delete(key);
  }
}

function setup() {
  const cached = new Map<string, ReminderListDto>();
  const cache = {
    save: async (userId: string, l: ReminderListDto) =>
      void cached.set(`${userId}:${l.gardenId}`, l),
    get: async (userId: string, gardenId: string) => cached.get(`${userId}:${gardenId}`) ?? null,
    delete: async (userId: string, gardenId: string) => void cached.delete(`${userId}:${gardenId}`),
  };
  const queue = new MemoryQueue();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: GardenRemindersCacheService, useValue: cache },
      { provide: RemindersOfflineQueue, useValue: queue },
      { provide: AuthApiService, useValue: { currentUserId: () => 'u1' } },
    ],
  });
  const api = TestBed.inject(RemindersApiService);
  api.localTodayAsOf = () => TODAY;
  return { api, backend: TestBed.inject(HttpTestingController), queue, cached };
}

/** Let the service's awaits run until it sends its next request. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const listUrl = (req: { url: string }) => req.url === '/api/gardens/g1/reminders';
const offline = { status: 0, statusText: 'Unknown Error' };

describe('RemindersApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('loads the list for the device’s day and keeps a copy for offline use', async () => {
    const t = setup();
    const loaded = t.api.list('g1');
    await settle();
    const req = t.backend.expectOne(listUrl);
    expect(req.request.params.get('asOf')).toBe(TODAY);
    req.flush(list([item()]));
    expect((await loaded)?.items).toHaveLength(1);
    expect(t.cached.get('u1:g1')?.items).toHaveLength(1);
  });

  it('queues a chore done offline and shows its next due day as pending', async () => {
    const t = setup();
    t.cached.set('u1:g1', list([item()]));
    const done = t.api.complete('g1', { plantingId: 'p1', kind: 'water', dueOn: '2026-06-09' }, 3);
    await settle();
    t.backend.expectOne('/api/gardens/g1/reminders/complete').flush(null, offline);
    await settle();
    // Reloading the list tries the queue first; still offline, the chore stays queued.
    t.backend.expectOne('/api/gardens/g1/reminders/complete').flush(null, offline);
    await settle();
    t.backend.expectOne(listUrl).flush(null, offline);
    const after = await done;
    expect([...t.queue.rows.keys()]).toEqual(['p1:water:2026-06-09']);
    expect(after?.items).toEqual([
      expect.objectContaining({ dueOn: '2026-06-12', urgency: 'upcoming', sync: 'pending' }),
    ]);
  });

  it('sends queued chores when back online, and marks one the server refuses', async () => {
    const t = setup();
    await t.queue.put({
      key: 'p1:water:2026-06-09',
      gardenId: 'g1',
      plantingId: 'p1',
      kind: 'water',
      dueOn: '2026-06-09',
      action: 'complete',
      intervalDays: 3,
      updatedAt: 1,
    });
    await t.queue.put({
      key: 'p2:fertilize:2026-06-01',
      gardenId: 'g1',
      plantingId: 'p2',
      kind: 'fertilize',
      dueOn: '2026-06-01',
      action: 'dismiss',
      intervalDays: 14,
      updatedAt: 2,
    });
    const loaded = t.api.list('g1');
    await settle();
    t.backend.expectOne('/api/gardens/g1/reminders/complete').flush('');
    await settle();
    t.backend
      .expectOne('/api/gardens/g1/reminders/dismiss')
      .flush(
        { error: { message: 'Planting not found' } },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();
    t.backend
      .expectOne(listUrl)
      .flush(list([item({ plantingId: 'p2', kind: 'fertilize', dueOn: '2026-06-01' })]));
    const after = await loaded;
    expect([...t.queue.rows.keys()]).toEqual(['p2:fertilize:2026-06-01']);
    expect(after?.items).toEqual([
      expect.objectContaining({
        plantingId: 'p2',
        sync: 'failed',
        syncMessage: 'Planting not found',
      }),
    ]);
  });

  it('forgets a property that is gone, its copy and its queue', async () => {
    const t = setup();
    t.cached.set('u1:g1', list([item()]));
    await t.queue.put({
      key: 'k',
      gardenId: 'g1',
      plantingId: 'p1',
      kind: 'water',
      dueOn: '2026-06-09',
      action: 'complete',
      intervalDays: 3,
      updatedAt: 1,
    });
    const loaded = t.api.list('g1');
    await settle();
    t.backend
      .expectOne('/api/gardens/g1/reminders/complete')
      .flush({ error: { message: 'Garden not found' } }, { status: 404, statusText: 'Not Found' });
    await settle();
    t.backend.expectOne(listUrl).flush({}, { status: 404, statusText: 'Not Found' });
    expect(await loaded).toBeNull();
    expect(t.cached.size).toBe(0);
    expect(t.queue.rows.size).toBe(0);
  });

  it('says to connect when offline with nothing saved, and passes a refused chore on', async () => {
    const t = setup();
    const loaded = t.api.list('g1');
    await settle();
    t.backend.expectOne(listUrl).flush(null, offline);
    await expect(loaded).rejects.toBeInstanceOf(RemindersColdOfflineError);

    const refused = t.api.dismiss('g1', { plantingId: 'p1', kind: 'water', dueOn: 'bad' }, 3);
    await settle();
    t.backend
      .expectOne('/api/gardens/g1/reminders/dismiss')
      .flush({ error: { message: 'Date must be YYYY-MM-DD' } }, { status: 400, statusText: 'Bad' });
    await expect(refused).rejects.toMatchObject({ status: 400 });
    expect(t.queue.rows.size).toBe(0);
  });
});

describe('rainForDeviceDay', () => {
  it('keeps the rain note only on the day its outlook was for', () => {
    const wet = list(
      [item({ required: false, rainNote: 'Rain expected' }), item({ kind: 'fertilize' })],
      {
        outlookOn: TODAY,
      },
    );
    expect(rainForDeviceDay(wet, TODAY)).toBe(wet);
    expect(rainForDeviceDay(wet, '2026-06-11').items).toEqual([
      expect.objectContaining({ kind: 'water', required: true, rainNote: null }),
      expect.objectContaining({ kind: 'fertilize' }),
    ]);
  });
});

describe('RemindersOfflineQueue.overlay', () => {
  const queue = new RemindersOfflineQueue();
  const queued = (over: Partial<ReminderQueueItem>): ReminderQueueItem => ({
    key: 'p1:water:2026-06-09',
    gardenId: 'g1',
    plantingId: 'p1',
    kind: 'water',
    dueOn: '2026-06-09',
    action: 'complete',
    intervalDays: null,
    updatedAt: 1,
    ...over,
  });

  it('shows a chore without an interval as pending where it was', () => {
    const shown = queue.overlay(list([item({ intervalDays: null })]), [queued({})]);
    expect(shown.items).toEqual([
      expect.objectContaining({ dueOn: '2026-06-09', sync: 'pending' }),
    ]);
  });

  it('does not repeat a harvest, and lists each chore once', () => {
    const harvest = item({ kind: 'harvest', dueOn: '2026-06-20', urgency: 'upcoming' });
    const shown = queue.overlay(list([harvest]), [
      queued({
        key: 'p1:harvest:2026-06-20',
        kind: 'harvest',
        dueOn: '2026-06-20',
        intervalDays: 7,
      }),
    ]);
    expect(shown.items.map((i) => [i.dueOn, i.sync])).toEqual([['2026-06-20', 'pending']]);
  });
});
