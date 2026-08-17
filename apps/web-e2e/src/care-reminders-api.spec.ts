import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

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
  plantings: Array<{ id: string; plantedOn: string | null; harvestedOn: string | null }>;
};

type GardenDetail = { id: string };

async function register(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/register', {
    data: { email, password: 'password123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { user: { id: string; email: string } }).user;
}

async function findPlant(request: APIRequestContext, name: string) {
  const res = await request.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items: Array<{ id: string; commonName: string }> };
  const plant = body.items.find((p) => p.commonName === name) ?? body.items[0];
  expect(plant, `missing plant ${name}`).toBeTruthy();
  return plant!;
}

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    return (body as { error?: { message?: string } }).error?.message;
  }
  return undefined;
}

async function json(res: APIResponse) {
  return res.json() as Promise<unknown>;
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function addPlanting(
  request: APIRequestContext,
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

test('unauthenticated reminder routes return 401', async ({ request }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const get = await request.get(`/api/gardens/${id}/reminders?asOf=2026-08-17`);
  expect(get.status()).toBe(401);
});

test('care reminders HTTP: authz, asOf, harvest, intervals, complete/dismiss', async ({
  playwright,
}) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const viewer = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `rem-api-owner-${stamp}@example.com`);
    const viewerUser = await register(viewer, `rem-api-viewer-${stamp}@example.com`);
    await register(stranger, `rem-api-stranger-${stamp}@example.com`);

    const created = await owner.post('/api/gardens', { data: { name: 'Reminder plot' } });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as GardenDetail;
    const asOf = todayIso();

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`);
    expect(strangerGet.status()).toBe(404);
    expect(errorMessage(await json(strangerGet))).toBe('Garden not found');

    const badAsOf = await owner.get(`/api/gardens/${garden.id}/reminders?asOf=bad`);
    expect(badAsOf.status()).toBe(400);
    expect(errorMessage(await json(badAsOf))).toBe('Date must be YYYY-MM-DD');

    const tomato = await findPlant(owner, 'Cherry Tomato');
    const herb = await findPlant(owner, 'Interval Herb');
    const tomatoId = await addPlanting(owner, garden.id, tomato.id, '2026-01-01');
    const herbId = await addPlanting(owner, garden.id, herb.id, '2026-01-01');

    const list = (await (
      await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
    ).json()) as ReminderList;
    expect(list.items.some((i) => i.kind === 'harvest' && i.plantingId === tomatoId)).toBe(true);
    expect(list.items.some((i) => i.kind === 'water' && i.commonName === 'Cherry Tomato')).toBe(
      false,
    );
    const herbWater = list.items.filter((i) => i.plantingId === herbId && i.kind === 'water');
    const herbFertilize = list.items.filter(
      (i) => i.plantingId === herbId && i.kind === 'fertilize',
    );
    expect(herbWater.length).toBeLessThanOrEqual(1);
    expect(herbFertilize.length).toBeLessThanOrEqual(1);

    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: viewerUser.email, role: 'viewer' },
    });
    const harvestItem = list.items.find((i) => i.plantingId === tomatoId && i.kind === 'harvest')!;
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
    expect(afterComplete.items.some((i) => i.plantingId === tomatoId && i.kind === 'harvest')).toBe(
      false,
    );

    const plantings = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(plantings.plantings.find((p) => p.id === tomatoId)?.harvestedOn).toBeNull();

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
    await owner.dispose();
    await viewer.dispose();
    await stranger.dispose();
  }
});
