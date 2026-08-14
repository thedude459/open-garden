import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

type GardenDetail = {
  id: string;
  name: string;
  notes: string | null;
  hardinessZone: number | null;
  lastFrost: { month: number; day: number } | null;
  firstFrost: { month: number; day: number } | null;
  myRole: string;
  ownerUserId: string;
  members: { userId: string; email: string; role: string }[];
};

async function register(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/register', {
    data: { email, password: 'password123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { user: { id: string; email: string } };
  return body.user;
}

function errorCode(res: APIResponse, body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: { code?: string } }).error;
    return err?.code;
  }
  return undefined;
}

test('unauthenticated garden routes return 401', async ({ request }) => {
  const list = await request.get('/api/gardens');
  expect(list.status()).toBe(401);
  const create = await request.post('/api/gardens', { data: { name: 'Nope' } });
  expect(create.status()).toBe(401);
});

test('CRUD isolation, duplicate name, last-write-wins, and delete', async ({ playwright }) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `api-owner-${stamp}@example.com`);
    await register(stranger, `api-stranger-${stamp}@example.com`);

    const created = await owner.post('/api/gardens', {
      data: { name: 'Backyard', notes: 'First notes' },
    });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as GardenDetail;
    expect(garden.myRole).toBe('owner');

    const dup = await owner.post('/api/gardens', { data: { name: ' backyard ' } });
    expect(dup.status()).toBe(409);
    expect(errorCode(dup, await dup.json())).toBe('CONFLICT');

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}`);
    expect(strangerGet.status()).toBe(404);
    expect(errorCode(strangerGet, await strangerGet.json())).toBe('NOT_FOUND');
    const strangerMembers = await stranger.get(`/api/gardens/${garden.id}/members`);
    expect(strangerMembers.status()).toBe(404);

    const firstPatch = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { notes: 'Owner notes' },
    });
    expect(firstPatch.ok()).toBeTruthy();
    const secondPatch = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { notes: 'Later notes' },
    });
    expect(secondPatch.ok()).toBeTruthy();
    const after = (await secondPatch.json()) as GardenDetail;
    expect(after.notes).toBe('Later notes');
    const reload = await owner.get(`/api/gardens/${garden.id}`);
    expect(((await reload.json()) as GardenDetail).notes).toBe('Later notes');

    const removed = await owner.delete(`/api/gardens/${garden.id}`);
    expect(removed.status()).toBe(204);
    const missing = await owner.get(`/api/gardens/${garden.id}`);
    expect(missing.status()).toBe(404);
  } finally {
    await owner.dispose();
    await stranger.dispose();
  }
});

test('site profile PATCH persists, clears one frost, and rejects invalid pairs', async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `api-site-${Date.now()}@example.com`);
    const created = await owner.post('/api/gardens', { data: { name: 'Site bed' } });
    const garden = (await created.json()) as GardenDetail;

    const saved = await owner.patch(`/api/gardens/${garden.id}`, {
      data: {
        hardinessZone: 7,
        lastFrost: { month: 4, day: 15 },
        firstFrost: { month: 10, day: 20 },
      },
    });
    expect(saved.ok()).toBeTruthy();
    const stored = (await saved.json()) as GardenDetail;
    expect(stored.hardinessZone).toBe(7);
    expect(stored.lastFrost).toEqual({ month: 4, day: 15 });
    expect(stored.firstFrost).toEqual({ month: 10, day: 20 });

    const cleared = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { firstFrost: null },
    });
    expect(((await cleared.json()) as GardenDetail).firstFrost).toBeNull();

    const reversed = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { lastFrost: { month: 10, day: 20 }, firstFrost: { month: 4, day: 15 } },
    });
    expect(reversed.status()).toBe(400);
    expect(errorCode(reversed, await reversed.json())).toBe('VALIDATION_ERROR');

    const sameDay = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { lastFrost: { month: 5, day: 1 }, firstFrost: { month: 5, day: 1 } },
    });
    expect(sameDay.status()).toBe(400);

    const badZone = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { hardinessZone: 0 },
    });
    expect(badZone.status()).toBe(400);
  } finally {
    await owner.dispose();
  }
});

test('membership invite, list visibility, transfer, and leave over HTTP', async ({ playwright }) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const friend = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    const ownerUser = await register(owner, `api-mem-owner-${stamp}@example.com`);
    const friendUser = await register(friend, `api-mem-friend-${stamp}@example.com`);
    await register(stranger, `api-mem-stranger-${stamp}@example.com`);

    const created = await owner.post('/api/gardens', { data: { name: 'Shared HTTP' } });
    const garden = (await created.json()) as GardenDetail;

    const unknown = await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: `nobody-${stamp}@example.com`, role: 'collaborator' },
    });
    expect(unknown.status()).toBe(404);
    expect(errorCode(unknown, await unknown.json())).toBe('NOT_FOUND');

    const invited = await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'collaborator' },
    });
    expect(invited.status()).toBe(201);

    const collabPatch = await friend.patch(`/api/gardens/${garden.id}`, {
      data: { notes: 'Collaborator first' },
    });
    expect(collabPatch.ok()).toBeTruthy();
    const ownerPatch = await owner.patch(`/api/gardens/${garden.id}`, {
      data: { notes: 'Owner last write' },
    });
    expect(((await ownerPatch.json()) as GardenDetail).notes).toBe('Owner last write');
    const afterBoth = (await (await friend.get(`/api/gardens/${garden.id}`)).json()) as GardenDetail;
    expect(afterBoth.notes).toBe('Owner last write');

    await owner.patch(`/api/gardens/${garden.id}/members/${friendUser.id}`, {
      data: { role: 'viewer' },
    });
    const viewerPatch = await friend.patch(`/api/gardens/${garden.id}`, {
      data: { notes: 'Viewer should fail' },
    });
    expect(viewerPatch.status()).toBe(403);
    expect(errorCode(viewerPatch, await viewerPatch.json())).toBe('FORBIDDEN');

    const dupInvite = await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'viewer' },
    });
    expect(dupInvite.status()).toBe(409);
    expect(errorCode(dupInvite, await dupInvite.json())).toBe('CONFLICT');

    const ownerMembers = await owner.get(`/api/gardens/${garden.id}/members`);
    const friendMembers = await friend.get(`/api/gardens/${garden.id}/members`);
    const ownerList = (await ownerMembers.json()) as { members: { email: string; role: string }[] };
    const friendList = (await friendMembers.json()) as {
      members: { email: string; role: string }[];
    };
    expect(ownerList.members.map((m) => m.email).sort()).toEqual(
      friendList.members.map((m) => m.email).sort(),
    );
    expect(ownerList.members.some((m) => m.email === ownerUser.email && m.role === 'owner')).toBe(
      true,
    );

    const strangerMembers = await stranger.get(`/api/gardens/${garden.id}/members`);
    expect(strangerMembers.status()).toBe(404);

    const transferred = await owner.patch(`/api/gardens/${garden.id}/members/${friendUser.id}`, {
      data: { role: 'owner' },
    });
    expect(transferred.ok()).toBeTruthy();
    const friendDetail = (await (await friend.get(`/api/gardens/${garden.id}`)).json()) as GardenDetail;
    expect(friendDetail.myRole).toBe('owner');
    const ownerDetail = (await (await owner.get(`/api/gardens/${garden.id}`)).json()) as GardenDetail;
    expect(ownerDetail.myRole).toBe('collaborator');

    const left = await owner.delete(`/api/gardens/${garden.id}/members/${ownerUser.id}`);
    expect(left.status()).toBe(204);
    const gone = await owner.get(`/api/gardens/${garden.id}`);
    expect(gone.status()).toBe(404);
  } finally {
    await owner.dispose();
    await friend.dispose();
    await stranger.dispose();
  }
});
