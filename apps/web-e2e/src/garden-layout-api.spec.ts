import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { Client } from 'pg';

type LayoutDto = {
  gardenId: string;
  myRole: string;
  beds: Array<{
    id: string;
    name: string;
    geometry: {
      originXInches: number;
      originYInches: number;
      lengthInches: number;
      widthInches: number;
      orientation: number;
    } | null;
  }>;
  plantings: Array<{
    id: string;
    plantId: string;
    commonName: string;
    bedId: string | null;
    spacingInches: number | null;
    placement: { plantingId: string; bedId: string; xInches: number; yInches: number } | null;
  }>;
  flags: Array<{ kind: string; blocking: boolean }>;
};

type PlantingList = {
  plantings: Array<{ id: string; bedId: string | null }>;
};

type GardenDetail = { id: string };
type NamedBed = { id: string; name: string };

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
  const body = (await res.json()) as {
    items: Array<{ id: string; commonName: string; spacingInches: number | null }>;
  };
  const plant = body.items.find((p) => p.commonName === name) ?? body.items[0];
  if (plant) return plant;
  if (name === 'Unknown Herb') {
    const leftover = await findOrSeedUnknownHerb();
    expect(leftover, 'missing leftover Unknown Herb').toBeTruthy();
    return leftover!;
  }
  expect(plant, `missing plant ${name}`).toBeTruthy();
  return plant!;
}

async function findOrSeedUnknownHerb(): Promise<{
  id: string;
  commonName: string;
  spacingInches: number | null;
} | null> {
  const url = process.env['DATABASE_URL'];
  if (!url) return null;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const existing = await client.query<{
      id: string;
      commonName: string;
      spacingInches: number | null;
    }>(
      `SELECT id, common_name AS "commonName", spacing_inches AS "spacingInches"
       FROM plants WHERE common_name = $1 LIMIT 1`,
      ['Unknown Herb'],
    );
    if (existing.rows[0]) return existing.rows[0];
    const inserted = await client.query<{
      id: string;
      commonName: string;
      spacingInches: number | null;
    }>(
      `INSERT INTO plants (
         variety_key, common_name, species, plant_type, zone_min, zone_max, spacing_inches, status
       ) VALUES ('herba ignota|', 'Unknown Herb', 'Herba ignota', 'herb', 3, 10, NULL, 'active')
       ON CONFLICT (variety_key) DO UPDATE SET common_name = EXCLUDED.common_name
       RETURNING id, common_name AS "commonName", spacing_inches AS "spacingInches"`,
    );
    return inserted.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function addPlanting(request: APIRequestContext, gardenId: string, plantId: string) {
  const res = await request.post(`/api/gardens/${gardenId}/plantings`, {
    data: { id: crypto.randomUUID(), plantId },
  });
  expect(res.status(), await res.text()).toBe(201);
  const list = (await res.json()) as PlantingList;
  return list.plantings[0]!;
}

async function addBed(request: APIRequestContext, gardenId: string, name: string) {
  const res = await request.post(`/api/gardens/${gardenId}/beds`, {
    data: { id: crypto.randomUUID(), name, lengthInches: 96, widthInches: 48 },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as NamedBed;
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

function bedPut(
  id: string,
  extra?: Partial<{
    originXInches: number;
    originYInches: number;
    lengthInches: number;
    widthInches: number;
    orientation: number;
  }>,
) {
  return {
    id,
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
    ...extra,
  };
}

test('unauthenticated layout routes return 401', async ({ request }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const get = await request.get(`/api/gardens/${id}/layout`);
  expect(get.status()).toBe(401);
  const put = await request.put(`/api/gardens/${id}/layout`, {
    data: { beds: [], placements: [] },
  });
  expect(put.status()).toBe(401);
});

test('layout HTTP: isolation, beds, 422 spacing/fit, placements, last-write-wins', async ({
  playwright,
}) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const friend = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `layout-api-owner-${stamp}@example.com`);
    const friendUser = await register(friend, `layout-api-friend-${stamp}@example.com`);
    await register(stranger, `layout-api-stranger-${stamp}@example.com`);

    const created = await owner.post('/api/gardens', { data: { name: 'Layout API plot' } });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as GardenDetail;
    const otherGarden = (await (
      await owner.post('/api/gardens', { data: { name: 'Other layout' } })
    ).json()) as GardenDetail;

    const strangerGet = await stranger.get(`/api/gardens/${garden.id}/layout`);
    expect(strangerGet.status()).toBe(404);
    const strangerGetBody = await json(strangerGet);
    expect(errorCode(strangerGetBody)).toBe('NOT_FOUND');
    expect(errorMessage(strangerGetBody)).toBe('Garden not found');
    const strangerPut = await stranger.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [], placements: [] },
    });
    expect(strangerPut.status()).toBe(404);
    expect(errorMessage(await json(strangerPut))).toBe('Garden not found');

    const east = await addBed(owner, garden.id, 'East');
    const west = await addBed(owner, garden.id, 'West');
    const otherBed = await addBed(owner, otherGarden.id, 'Other east');
    const tomato = await findPlant(owner, 'Cherry Tomato');
    const basil = await findPlant(owner, 'Sweet Basil');
    const unknown = await findPlant(owner, 'Unknown Herb');
    const a = await addPlanting(owner, garden.id, tomato.id);
    const b = await addPlanting(owner, garden.id, tomato.id);
    const basilRow = await addPlanting(owner, garden.id, basil.id);
    const unknownRow = await addPlanting(owner, garden.id, unknown.id);

    const firstPut = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id), bedPut(west.id, { originYInches: 60, lengthInches: 40, widthInches: 20 })],
        placements: [],
      },
    });
    expect(firstPut.status(), await firstPut.text()).toBe(200);
    const first = (await firstPut.json()) as LayoutDto;
    expect(first.beds.find((bed) => bed.id === east.id)?.geometry?.lengthInches).toBe(96);
    expect(first.beds.find((bed) => bed.id === west.id)?.geometry?.lengthInches).toBe(40);

    const laterPut = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id, { lengthInches: 80 }), bedPut(west.id, { originYInches: 60, lengthInches: 40, widthInches: 20 })],
        placements: [],
      },
    });
    expect(laterPut.status()).toBe(200);
    const laterGet = (await (await owner.get(`/api/gardens/${garden.id}/layout`)).json()) as LayoutDto;
    expect(laterGet.beds.find((bed) => bed.id === east.id)?.geometry?.lengthInches).toBe(80);

    const omitWest = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [bedPut(east.id, { lengthInches: 80 })], placements: [] },
    });
    expect(omitWest.status()).toBe(200);
    const omitted = (await omitWest.json()) as LayoutDto;
    expect(omitted.beds.find((bed) => bed.id === west.id)?.name).toBe('West');
    expect(omitted.beds.find((bed) => bed.id === west.id)?.geometry?.lengthInches).toBe(40);

    const foreign = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [bedPut(otherBed.id)], placements: [] },
    });
    expect(foreign.status()).toBe(404);
    expect(errorMessage(await json(foreign))).toBe('Bed not found');

    const tooClose = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id, { lengthInches: 80 })],
        placements: [
          { plantingId: a.id, bedId: east.id, xInches: 20, yInches: 20 },
          { plantingId: b.id, bedId: east.id, xInches: 30, yInches: 20 },
        ],
      },
    });
    expect(tooClose.status()).toBe(422);
    const tooCloseBody = await json(tooClose);
    expect(errorCode(tooCloseBody)).toBe('VALIDATION_ERROR');
    expect(errorMessage(tooCloseBody)).toBe('Layout has spacing or fit problems');
    const afterClose = (await (await owner.get(`/api/gardens/${garden.id}/layout`)).json()) as LayoutDto;
    expect(afterClose.plantings.every((p) => p.placement === null)).toBe(true);
    expect(afterClose.beds.find((bed) => bed.id === east.id)?.geometry?.lengthInches).toBe(80);

    const mixed = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id, { lengthInches: 80 })],
        placements: [
          { plantingId: a.id, bedId: east.id, xInches: 20, yInches: 20 },
          { plantingId: basilRow.id, bedId: east.id, xInches: 38, yInches: 20 },
        ],
      },
    });
    expect(mixed.status()).toBe(422);
    expect(errorMessage(await json(mixed))).toBe('Layout has spacing or fit problems');

    const unknownOk = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id, { lengthInches: 80 })],
        placements: [
          { plantingId: a.id, bedId: east.id, xInches: 24, yInches: 24 },
          { plantingId: unknownRow.id, bedId: east.id, xInches: 25, yInches: 24 },
        ],
      },
    });
    expect(unknownOk.status(), await unknownOk.text()).toBe(200);
    const unknownLayout = (await unknownOk.json()) as LayoutDto;
    expect(unknownLayout.flags.some((f) => f.kind === 'unavailable' && !f.blocking)).toBe(true);
    expect(unknownLayout.plantings.find((p) => p.id === a.id)?.bedId).toBe(east.id);

    const plantings = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(plantings.plantings.find((p) => p.id === a.id)?.bedId).toBe(east.id);

    const unplace = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [bedPut(east.id, { lengthInches: 80 })],
        placements: [{ plantingId: unknownRow.id, bedId: east.id, xInches: 25, yInches: 24 }],
      },
    });
    expect(unplace.status()).toBe(200);
    const unplaced = (await unplace.json()) as LayoutDto;
    expect(unplaced.plantings.find((p) => p.id === a.id)?.placement).toBeNull();
    expect(unplaced.plantings.find((p) => p.id === a.id)?.bedId).toBe(east.id);

    const afterUnplaceList = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(afterUnplaceList.plantings.find((p) => p.id === a.id)?.bedId).toBe(east.id);

    const del = await owner.delete(`/api/gardens/${garden.id}/beds/${east.id}`);
    expect(del.status()).toBe(204);
    const afterDel = (await (await owner.get(`/api/gardens/${garden.id}/layout`)).json()) as LayoutDto;
    expect(afterDel.beds.find((bed) => bed.id === east.id)).toBeUndefined();
    expect(afterDel.plantings.every((p) => p.bedId === null && p.placement === null)).toBe(true);
    const afterDelList = (await (
      await owner.get(`/api/gardens/${garden.id}/plantings`)
    ).json()) as PlantingList;
    expect(afterDelList.plantings.every((p) => p.bedId === null)).toBe(true);

    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'viewer' },
    });
    const viewerGet = await friend.get(`/api/gardens/${garden.id}/layout`);
    expect(viewerGet.status()).toBe(200);
    const viewerPut = await friend.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [], placements: [] },
    });
    expect(viewerPut.status()).toBe(403);
    expect(errorMessage(await json(viewerPut))).toBe('Viewers cannot update layout');
  } finally {
    await owner.dispose();
    await friend.dispose();
    await stranger.dispose();
  }
});

test('area DELETE 401/403/404 and PUT empty/duplicate area names', async ({ playwright }) => {
  const stamp = Date.now();
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const friend = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  const anon = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
  try {
    await register(owner, `layout-area-owner-${stamp}@example.com`);
    const friendUser = await register(friend, `layout-area-friend-${stamp}@example.com`);
    const created = await owner.post('/api/gardens', { data: { name: 'Area API plot' } });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as GardenDetail;
    const areaId = crypto.randomUUID();
    const otherId = crypto.randomUUID();
    const area = {
      id: areaId,
      name: 'Path',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 48,
      widthInches: 24,
    };

    const emptyName = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [], placements: [], areas: [{ ...area, name: '' }] },
    });
    expect(emptyName.status()).toBe(400);

    const first = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: { beds: [], placements: [], areas: [area] },
    });
    expect(first.status(), await first.text()).toBe(200);

    const duplicate = await owner.put(`/api/gardens/${garden.id}/layout`, {
      data: {
        beds: [],
        placements: [],
        areas: [area, { ...area, id: otherId, originYInches: 30 }],
      },
    });
    expect(duplicate.status()).toBe(409);
    expect(errorMessage(await json(duplicate))).toBe('That garden already has an area with that name');

    const missing = crypto.randomUUID();
    const anonDel = await anon.delete(`/api/gardens/${garden.id}/areas/${areaId}`);
    expect(anonDel.status()).toBe(401);

    const stranger = await playwright.request.newContext({ baseURL: 'http://localhost:4200' });
    await register(stranger, `layout-area-stranger-${stamp}@example.com`);
    const strangerDel = await stranger.delete(`/api/gardens/${garden.id}/areas/${areaId}`);
    expect(strangerDel.status()).toBe(404);
    await stranger.dispose();

    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: friendUser.email, role: 'viewer' },
    });
    const viewerDel = await friend.delete(`/api/gardens/${garden.id}/areas/${areaId}`);
    expect(viewerDel.status()).toBe(403);

    const missingDel = await owner.delete(`/api/gardens/${garden.id}/areas/${missing}`);
    expect(missingDel.status()).toBe(404);
  } finally {
    await owner.dispose();
    await friend.dispose();
    await anon.dispose();
  }
});
