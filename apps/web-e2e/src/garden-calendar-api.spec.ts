import { expect, test, type APIRequestContext } from '@playwright/test';

type CalendarDto = {
  gardenId: string;
  myRole: string;
  windowsAvailable: boolean;
  hardinessZone: number | null;
  lastFrost: { month: number; day: number } | null;
  firstFrost: { month: number; day: number } | null;
  entries: Array<{
    plantId: string;
    commonName: string;
    zoneMismatch: boolean | null;
    windows: {
      indoorStart: { earliest: { month: number; day: number } } | null;
      outdoorSow: { earliest: { month: number; day: number } } | null;
      transplant: unknown;
      harvest: unknown;
    };
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

async function createGarden(request: APIRequestContext, name: string, frost?: {
  lastDay: number;
}) {
  const created = await request.post('/api/gardens', { data: { name } });
  expect(created.status()).toBe(201);
  const garden = (await created.json()) as GardenDetail;
  const saved = await request.patch(`/api/gardens/${garden.id}`, {
    data: {
      hardinessZone: 7,
      lastFrost: { month: 4, day: frost?.lastDay ?? 15 },
      firstFrost: { month: 10, day: 20 },
    },
  });
  expect(saved.ok()).toBeTruthy();
  return garden;
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

test('unauthenticated calendar routes return 401', async ({ request }) => {
  const get = await request.get('/api/gardens/11111111-1111-4111-8111-111111111111/calendar');
  expect(get.status()).toBe(401);
});

test('non-member GET is 404 and incomplete frost sets windowsAvailable false', async ({
  playwright,
}) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `cal-api-owner-${stamp}@example.com`);
    await register(stranger, `cal-api-stranger-${stamp}@example.com`);
    const created = await owner.post('/api/gardens', { data: { name: 'Bare frost' } });
    const garden = (await created.json()) as GardenDetail;
    const tomato = await findPlant(owner, 'Cherry Tomato');
    const added = await owner.post(`/api/gardens/${garden.id}/calendar`, {
      data: { plantId: tomato.id },
    });
    expect(added.status()).toBe(201);
    const calendar = (await added.json()) as CalendarDto;
    expect(calendar.windowsAvailable).toBe(false);
    expect(calendar.entries[0]?.windows.indoorStart).toBeNull();
    expect(JSON.stringify(calendar)).not.toContain('emphasized');

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}/calendar`);
    expect(strangerGet.status()).toBe(404);
    expect(errorCode(await strangerGet.json())).toBe('NOT_FOUND');
  } finally {
    await owner.dispose();
    await stranger.dispose();
  }
});

test('SC-003 same plant on two gardens with different last frost', async ({ playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `cal-sc003-${Date.now()}@example.com`);
    const early = await createGarden(owner, 'Early frost', { lastDay: 1 });
    const late = await createGarden(owner, 'Late frost', { lastDay: 30 });
    const tomato = await findPlant(owner, 'Cherry Tomato');
    await owner.post(`/api/gardens/${early.id}/calendar`, { data: { plantId: tomato.id } });
    await owner.post(`/api/gardens/${late.id}/calendar`, { data: { plantId: tomato.id } });
    const a = (await (await owner.get(`/api/gardens/${early.id}/calendar`)).json()) as CalendarDto;
    const b = (await (await owner.get(`/api/gardens/${late.id}/calendar`)).json()) as CalendarDto;
    expect(a.entries[0]?.windows.indoorStart?.earliest).not.toEqual(
      b.entries[0]?.windows.indoorStart?.earliest,
    );
    expect(a.entries[0]?.windows.outdoorSow).toBeNull();
    expect(b.entries[0]?.windows.outdoorSow).toBeNull();
  } finally {
    await owner.dispose();
  }
});

test('POST 201 then 200, DELETE 204 twice, viewer 403, stranger 404, unknown plant 404', async ({
  playwright,
}) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const friend = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `cal-mut-owner-${stamp}@example.com`);
    const friendUser = await register(friend, `cal-mut-friend-${stamp}@example.com`);
    await register(stranger, `cal-mut-stranger-${stamp}@example.com`);
    const garden = await createGarden(owner, 'Mutate bed');
    const tomato = await findPlant(owner, 'Cherry Tomato');

    const first = await owner.post(`/api/gardens/${garden.id}/calendar`, {
      data: { plantId: tomato.id },
    });
    expect(first.status()).toBe(201);
    const dup = await owner.post(`/api/gardens/${garden.id}/calendar`, {
      data: { plantId: tomato.id },
    });
    expect(dup.status()).toBe(200);
    expect(((await dup.json()) as CalendarDto).total).toBe(1);

    const unknown = await owner.post(`/api/gardens/${garden.id}/calendar`, {
      data: { plantId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(unknown.status()).toBe(404);
    expect(errorMessage(await unknown.json())).toBe('Plant not found');

    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'viewer' },
    });
    const viewerPost = await friend.post(`/api/gardens/${garden.id}/calendar`, {
      data: { plantId: tomato.id },
    });
    expect(viewerPost.status()).toBe(403);
    expect(errorMessage(await viewerPost.json())).toBe('Viewers cannot update this calendar');
    const viewerDel = await friend.delete(
      `/api/gardens/${garden.id}/calendar/${tomato.id}`,
    );
    expect(viewerDel.status()).toBe(403);

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}/calendar`);
    expect(strangerGet.status()).toBe(404);
    const strangerDel = await stranger.delete(
      `/api/gardens/${garden.id}/calendar/${tomato.id}`,
    );
    expect(strangerDel.status()).toBe(404);

    const del1 = await owner.delete(`/api/gardens/${garden.id}/calendar/${tomato.id}`);
    expect(del1.status()).toBe(204);
    const del2 = await owner.delete(`/api/gardens/${garden.id}/calendar/${tomato.id}`);
    expect(del2.status()).toBe(204);
  } finally {
    await owner.dispose();
    await friend.dispose();
    await stranger.dispose();
  }
});
