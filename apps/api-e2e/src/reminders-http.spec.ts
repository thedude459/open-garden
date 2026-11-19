import { fixturePlace } from './fixture-place';
import { describe, expect, test } from 'vitest';
import { liveEnabled, LiveClient, type LiveResponse } from './live-http';

describe.skipIf(!liveEnabled)('reminders http', () => {
  type ReminderList = {
    gardenId: string;
    myRole: string;
    asOf: string;
    items: Array<{
      plantingId: string;
      kind: string;
      dueOn: string;
      urgency: string;
      commonName: string;
    }>;
  };

  type PlantingList = {
    plantings: Array<{
      id: string;
      plannedOn?: string | null;
      plantedOn: string | null;
      harvestedOn: string | null;
    }>;
  };

  type GardenDetail = { id: string };

  async function register(request: LiveClient, email: string) {
    const res = await request.post('/api/auth/register', {
      data: { email, password: 'password123' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return ((await res.json()) as { user: { id: string; email: string } }).user;
  }

  async function findPlant(request: LiveClient, name: string) {
    const res = await request.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    // The crop's own row, not one of its varieties (they share the name).
    const plant = body.items.find((p) => p.commonName === name && !p.cultivar);
    expect(plant, `missing plant ${name}`).toBeTruthy();
    return plant!;
  }

  function errorMessage(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'error' in body) {
      return (body as { error?: { message?: string } }).error?.message;
    }
    return undefined;
  }

  async function json(res: LiveResponse) {
    return res.json();
  }

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** The member's local date `days` from today. */
  function laterIso(days: number) {
    return new Date(Date.parse(`${todayIso()}T00:00:00Z`) + days * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }

  async function addPlanting(
    request: LiveClient,
    gardenId: string,
    plantId: string,
    plantedOn?: string,
  ) {
    const res = await request.post(`/api/gardens/${gardenId}/plantings`, {
      data: { id: crypto.randomUUID(), plantId },
    });
    expect(res.status(), await res.text()).toBe(201);
    const list = (await res.json()) as PlantingList;
    const planting = list.plantings[0]!;
    if (plantedOn) {
      const patch = await request.patch(`/api/gardens/${gardenId}/plantings/${planting.id}`, {
        data: { plantedOn },
      });
      expect(patch.ok()).toBeTruthy();
    }
    return planting.id;
  }

  test('unauthenticated reminder routes return 401', async () => {
    const request = new LiveClient();
    const id = '11111111-1111-4111-8111-111111111111';
    const get = await request.get(`/api/gardens/${id}/reminders?asOf=2026-08-17`);
    expect(get.status()).toBe(401);
  });

  test('a planting planned ahead gets a Sow task until it is marked done', async () => {
    const owner = new LiveClient();
    await register(owner, `rem-sow-${Date.now()}@example.com`);
    const garden = (await (
      await owner.post('/api/gardens', { data: { place: fixturePlace, name: 'Sow plot' } })
    ).json()) as GardenDetail;
    const asOf = todayIso();
    const later = laterIso(14);
    const lettuce = await findPlant(owner, 'Lettuce');
    const plannedId = await addPlanting(owner, garden.id, lettuce.id, later);
    const sownId = await addPlanting(owner, garden.id, lettuce.id, asOf);

    const reminders = async () =>
      (
        (await (
          await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
        ).json()) as ReminderList
      ).items.filter((i) => i.kind === 'sow');
    expect(await reminders()).toEqual([
      expect.objectContaining({ plantingId: plannedId, dueOn: later, urgency: 'upcoming' }),
    ]);
    expect((await reminders()).some((i) => i.plantingId === sownId)).toBe(false);

    // Done today, ahead of plan: the planting is planted today (ADR 0040).
    const done = await owner.post(`/api/gardens/${garden.id}/reminders/complete`, {
      data: { plantingId: plannedId, kind: 'sow', dueOn: later, doneOn: asOf },
    });
    expect(done.status(), await done.text()).toBe(204);
    expect(await reminders()).toEqual([]);
    const planting = async () =>
      (
        (await (await owner.get(`/api/gardens/${garden.id}/plantings`)).json()) as {
          plantings: { id: string; plannedOn: string | null; plantedOn: string | null }[];
        }
      ).plantings.find((p) => p.id === plannedId);
    expect(await planting()).toMatchObject({ plannedOn: later, plantedOn: asOf });

    // Undone, it is planned again and its Sow task comes back.
    const undone = await owner.post(`/api/gardens/${garden.id}/reminders/undo`, {
      data: { plantingId: plannedId, kind: 'sow', dueOn: later },
    });
    expect(undone.status(), await undone.text()).toBe(204);
    expect(await planting()).toMatchObject({ plannedOn: later, plantedOn: null });
    expect((await reminders()).map((i) => i.plantingId)).toEqual([plannedId]);
  });

  test('a succession series adds dated sowings, each with its own Sow task', async () => {
    const owner = new LiveClient();
    const viewer = new LiveClient();
    await register(owner, `rem-series-${Date.now()}@example.com`);
    const viewerUser = await register(viewer, `rem-series-v-${Date.now()}@example.com`);
    const garden = (await (
      await owner.post('/api/gardens', { data: { place: fixturePlace, name: 'Series plot' } })
    ).json()) as GardenDetail;
    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: viewerUser.email, role: 'viewer' },
    });
    // Next spring at the test address (frost Apr 15 and Oct 20): radish sows
    // Mar 11 to Apr 29 and again Sep 8 to Oct 6, which is also its last sowing.
    const y = new Date().getFullYear() + 1;
    const radish = await findPlant(owner, 'Radish');
    const firstId = await addPlanting(owner, garden.id, radish.id, `${y}-03-11`);
    const repeatUrl = `/api/gardens/${garden.id}/plantings/${firstId}/repeat`;

    const asViewer = await viewer.post(repeatUrl, { data: { everyWeeks: 2, until: `${y}-10-31` } });
    expect(asViewer.status()).toBe(403);
    const badWeeks = await owner.post(repeatUrl, { data: { everyWeeks: 0, until: `${y}-10-31` } });
    expect(badWeeks.status()).toBe(400);
    const plan = await owner.get(repeatUrl);
    expect(await plan.json()).toEqual({ lastSowOn: `${y}-10-06` });

    const repeated = await owner.post(repeatUrl, { data: { everyWeeks: 2, until: `${y}-10-31` } });
    expect(repeated.status(), await repeated.text()).toBe(201);
    const result = (await repeated.json()) as {
      list: PlantingList;
      added: number;
      outOfWindow: number;
      tooLate: number;
    };
    // Every two weeks: three in spring, none in the summer gap, two in fall,
    // and the two in October after the last useful sowing left out.
    expect(result).toMatchObject({ added: 5, outOfWindow: 9, tooLate: 2 });
    const copies = result.list.plantings.filter((p) => p.id !== firstId);
    // Each copy is a sowing still to come (ADR 0040).
    expect(copies.map((p) => p.plannedOn).sort()).toEqual(
      ['03-25', '04-08', '04-22', '09-09', '09-23'].map((d) => `${y}-${d}`),
    );

    const sow = (
      (await (
        await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${todayIso()}`)
      ).json()) as ReminderList
    ).items.filter((i) => i.kind === 'sow');
    // The first sowing was recorded ahead too, so it has a Sow task as well.
    expect(sow.map((i) => i.plantingId).sort()).toEqual(
      [firstId, ...copies.map((p) => p.id)].sort(),
    );
  });

  test('care reminders HTTP: authz, asOf, harvest, intervals, complete/dismiss', async () => {
    const stamp = Date.now();
    const owner = new LiveClient();
    const viewer = new LiveClient();
    const stranger = new LiveClient();
    try {
      await register(owner, `rem-api-owner-${stamp}@example.com`);
      const viewerUser = await register(viewer, `rem-api-viewer-${stamp}@example.com`);
      await register(stranger, `rem-api-stranger-${stamp}@example.com`);

      const created = await owner.post('/api/gardens', {
        data: { place: fixturePlace, name: 'Reminder plot' },
      });
      expect(created.status()).toBe(201);
      const garden = (await created.json()) as GardenDetail;
      const asOf = todayIso();

      const strangerGet = await stranger.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`);
      expect(strangerGet.status()).toBe(404);
      expect(errorMessage(await json(strangerGet))).toBe('Garden not found');

      const badAsOf = await owner.get(`/api/gardens/${garden.id}/reminders?asOf=bad`);
      expect(badAsOf.status()).toBe(400);
      expect(errorMessage(await json(badAsOf))).toBe('Date must be YYYY-MM-DD');

      const tomato = await findPlant(owner, 'Tomato');
      const herb = await findPlant(owner, 'Basil');
      const tomatoId = await addPlanting(owner, garden.id, tomato.id, '2026-01-01');
      const herbId = await addPlanting(owner, garden.id, herb.id, '2026-01-01');

      const list = (await (
        await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
      ).json()) as ReminderList;
      expect(list.items.some((i) => i.kind === 'harvest' && i.plantingId === tomatoId)).toBe(true);
      // One reminder per kind per planting, not one per missed interval.
      expect(
        list.items.filter((i) => i.plantingId === tomatoId && i.kind === 'water').length,
      ).toBeLessThanOrEqual(1);
      const herbWater = list.items.filter((i) => i.plantingId === herbId && i.kind === 'water');
      const herbFertilize = list.items.filter(
        (i) => i.plantingId === herbId && i.kind === 'fertilize',
      );
      expect(herbWater.length).toBeLessThanOrEqual(1);
      expect(herbFertilize.length).toBeLessThanOrEqual(1);

      await owner.post(`/api/gardens/${garden.id}/members`, {
        data: { email: viewerUser.email, role: 'viewer' },
      });
      const harvestItem = list.items.find(
        (i) => i.plantingId === tomatoId && i.kind === 'harvest',
      )!;
      const viewerPost = await viewer.post(`/api/gardens/${garden.id}/reminders/complete`, {
        data: { plantingId: tomatoId, kind: 'harvest', dueOn: harvestItem.dueOn },
      });
      expect(viewerPost.status()).toBe(403);
      expect(errorMessage(await json(viewerPost))).toBe('Viewers cannot update reminders');

      const complete = await owner.post(`/api/gardens/${garden.id}/reminders/complete`, {
        data: { plantingId: tomatoId, kind: 'harvest', dueOn: harvestItem.dueOn },
      });
      expect(complete.status()).toBe(204);

      const afterComplete = (await (
        await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
      ).json()) as ReminderList;
      expect(
        afterComplete.items.some((i) => i.plantingId === tomatoId && i.kind === 'harvest'),
      ).toBe(false);

      const plantings = (await (
        await owner.get(`/api/gardens/${garden.id}/plantings`)
      ).json()) as PlantingList;
      expect(plantings.plantings.find((p) => p.id === tomatoId)?.harvestedOn).toBe(
        harvestItem.dueOn,
      );

      const dismiss = await owner.post(`/api/gardens/${garden.id}/reminders/dismiss`, {
        data: { plantingId: tomatoId, kind: 'harvest', dueOn: harvestItem.dueOn },
      });
      expect(dismiss.status()).toBe(204);

      const stale = await owner.post(`/api/gardens/${garden.id}/reminders/complete`, {
        data: { plantingId: tomatoId, kind: 'harvest', dueOn: '2020-01-01' },
      });
      expect(stale.status()).toBe(204);
      const afterStale = (await (
        await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
      ).json()) as ReminderList;
      expect(afterStale.items.some((i) => i.plantingId === tomatoId && i.kind === 'harvest')).toBe(
        false,
      );

      await owner.delete(`/api/gardens/${garden.id}/plantings/${herbId}`);
      const afterDelete = (await (
        await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
      ).json()) as ReminderList;
      expect(afterDelete.items.every((i) => i.plantingId !== herbId)).toBe(true);
    } finally {
      owner.dispose();
      viewer.dispose();
      stranger.dispose();
    }
  });
});
