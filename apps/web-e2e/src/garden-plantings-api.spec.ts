import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

type PlantingList = {
  gardenId: string;
  myRole: string;
  beds: Array<{ id: string; name: string }>;
  plantings: Array<{
    id: string;
    plantId: string;
    commonName: string;
    plantedOn: string | null;
    harvestedOn: string | null;
    bedId: string | null;
  }>;
  page: number;
  pageSize: number;
  total: number;
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

function errorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    return (body as { error?: { code?: string } }).error?.code;
  }
  return undefined;
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

test('unauthenticated planting routes return 401', async ({ request }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const get = await request.get(`/api/gardens/${id}/plantings`);
  expect(get.status()).toBe(401);
  const post = await request.post(`/api/gardens/${id}/plantings`, {
    data: { plantId: id },
  });
  expect(post.status()).toBe(401);
});

test('plantings HTTP: isolation, idempotent id, duplicates, 404 delete, last-write-wins, beds', async ({
  playwright,
}) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const friend = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `plant-api-owner-${stamp}@example.com`);
    const friendUser = await register(friend, `plant-api-friend-${stamp}@example.com`);
    await register(stranger, `plant-api-stranger-${stamp}@example.com`);

    const created = await owner.post('/api/gardens', { data: { name: 'Planting plot' } });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as GardenDetail;
    const otherGarden = (await (
      await owner.post('/api/gardens', { data: { name: 'Other plot' } })
    ).json()) as GardenDetail;
    const tomato = await findPlant(owner, 'Cherry Tomato');

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}/plantings`);
    expect(strangerGet.status()).toBe(404);
    const strangerBody = await json(strangerGet);
    expect(errorCode(strangerBody)).toBe('NOT_FOUND');
    expect(errorMessage(strangerBody)).toBe('Garden not found');

    const clientId = crypto.randomUUID();
    const first = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { id: clientId, plantId: tomato.id },
    });
    expect(first.status()).toBe(201);
    const firstList = (await first.json()) as PlantingList;
    expect(firstList.total).toBe(1);
    expect(firstList.plantings[0]?.id).toBe(clientId);

    const retry = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { id: clientId, plantId: tomato.id },
    });
    expect(retry.status()).toBe(200);
    expect(((await retry.json()) as PlantingList).total).toBe(1);

    const otherId = await owner.post(`/api/gardens/${otherGarden.id}/plantings`, {
      data: { id: clientId, plantId: tomato.id },
    });
    expect(otherId.status()).toBe(409);
    expect(errorMessage(await json(otherId))).toBe('That id is already in use');

    const second = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { plantId: tomato.id },
    });
    expect(second.status()).toBe(201);
    const two = (await second.json()) as PlantingList;
    expect(two.total).toBe(2);

    const missingPatch = await owner.patch(
      `/api/gardens/${garden.id}/plantings/${crypto.randomUUID()}`,
      { data: { plantedOn: '2026-06-01' } },
    );
    expect(missingPatch.status()).toBe(404);
    expect(errorMessage(await json(missingPatch))).toBe('Planting not found');
    const afterMissing = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(afterMissing.total).toBe(2);

    const plantingId = two.plantings[0]!.id;
    const firstDate = await owner.patch(`/api/gardens/${garden.id}/plantings/${plantingId}`, {
      data: { plantedOn: '2026-05-01' },
    });
    expect(firstDate.ok()).toBeTruthy();
    const laterDate = await owner.patch(`/api/gardens/${garden.id}/plantings/${plantingId}`, {
      data: { plantedOn: '2026-07-01' },
    });
    expect(laterDate.ok()).toBeTruthy();
    expect(((await laterDate.json()) as { plantedOn: string }).plantedOn).toBe('2026-07-01');
    const afterDates = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(afterDates.plantings.find((p) => p.id === plantingId)?.plantedOn).toBe('2026-07-01');

    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'viewer' },
    });
    const viewerPost = await friend.post(`/api/gardens/${garden.id}/plantings`, {
      data: { plantId: tomato.id },
    });
    expect(viewerPost.status()).toBe(403);
    expect(errorMessage(await json(viewerPost))).toBe('Viewers cannot update plantings');
    const viewerPatch = await friend.patch(`/api/gardens/${garden.id}/plantings/${plantingId}`, {
      data: { plantedOn: '2026-01-01' },
    });
    expect(viewerPatch.status()).toBe(403);
    const viewerDel = await friend.delete(`/api/gardens/${garden.id}/plantings/${plantingId}`);
    expect(viewerDel.status()).toBe(403);
    expect(errorMessage(await json(viewerDel))).toBe('Viewers cannot update plantings');

    const bed = await owner.post(`/api/gardens/${garden.id}/beds`, { data: { name: 'Raised bed 1' } });
    expect(bed.status()).toBe(201);
    const bedBody = (await bed.json()) as { id: string; name: string };
    const dupBed = await owner.post(`/api/gardens/${garden.id}/beds`, { data: { name: 'raised bed 1' } });
    expect(dupBed.status()).toBe(409);
    expect(errorMessage(await json(dupBed))).toBe('That garden already has a bed with that name');

    const otherBed = await owner.post(`/api/gardens/${otherGarden.id}/beds`, {
      data: { name: 'Foreign bed' },
    });
    const otherBedId = ((await otherBed.json()) as { id: string }).id;
    const wrongBed = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { plantId: tomato.id, bedId: otherBedId },
    });
    expect(wrongBed.status()).toBe(404);
    expect(errorMessage(await json(wrongBed))).toBe('Bed not found');

    await owner.patch(`/api/gardens/${garden.id}/plantings/${plantingId}`, {
      data: { bedId: bedBody.id },
    });
    const viewerBed = await friend.post(`/api/gardens/${garden.id}/beds`, { data: { name: 'Nope' } });
    expect(viewerBed.status()).toBe(403);
    expect(errorMessage(await json(viewerBed))).toBe('Viewers cannot update beds');

    const delBed = await owner.delete(`/api/gardens/${garden.id}/beds/${bedBody.id}`);
    expect(delBed.status()).toBe(204);
    const unassigned = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(unassigned.plantings.find((p) => p.id === plantingId)?.bedId).toBeNull();

    const del1 = await owner.delete(`/api/gardens/${garden.id}/plantings/${plantingId}`);
    expect(del1.status()).toBe(204);
    const del2 = await owner.delete(`/api/gardens/${garden.id}/plantings/${plantingId}`);
    expect(del2.status()).toBe(404);
    expect(errorMessage(await json(del2))).toBe('Planting not found');
  } finally {
    await owner.dispose();
    await friend.dispose();
    await stranger.dispose();
  }
});
