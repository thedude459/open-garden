// Live HTTP tests for the endpoints no other live spec reached: logout, areas
// and trays, bed edits, the transplants list, undoing a task, and seasons.
import { beforeAll, describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('property, season, and session http', () => {
  type Plant = { id: string; commonName: string; cultivar: string | null };

  async function plantId(client: LiveClient, name: string, cultivar: string): Promise<string> {
    const res = await client.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    expect(res.ok()).toBe(true);
    const { items } = (await res.json()) as { items: Plant[] };
    const plant = items.find((p) => p.commonName === name && p.cultivar === cultivar);
    expect(plant, `${name} (${cultivar}) in the catalog`).toBeTruthy();
    return plant!.id;
  }

  // Registering hashes a password, which is deliberately slow; one owner,
  // viewer, and stranger serve every test so the suite does not crowd the
  // other live specs sharing this API.
  const owner = new LiveClient();
  const viewer = new LiveClient();
  const stranger = new LiveClient();
  let viewerEmail = '';
  beforeAll(async () => {
    await owner.register(uniqueEmail('psh-owner'));
    viewerEmail = uniqueEmail('psh-viewer');
    await viewer.register(viewerEmail);
    await stranger.register(uniqueEmail('psh-stranger'));
  });

  /** A fresh property owned by `owner`, with `viewer` invited as a viewer. */
  async function property(label: string) {
    const created = await owner.post('/api/gardens', {
      data: { place: fixturePlace, name: `${label} plot ${Date.now()}` },
    });
    expect(created.status(), await created.text()).toBe(201);
    const id = ((await created.json()) as { id: string }).id;
    const invite = await owner.post(`/api/gardens/${id}/members`, {
      data: { email: viewerEmail, role: 'viewer' },
    });
    expect(invite.ok(), await invite.text()).toBe(true);
    return { owner, viewer, stranger, id };
  }

  test('logout ends the session on the server', async () => {
    const client = new LiveClient();
    await client.register(uniqueEmail('logout'));
    expect((await client.get('/api/gardens')).status()).toBe(200);
    expect((await client.post('/api/auth/logout')).status()).toBe(204);
    // The client still sends the old cookie; the server no longer knows it.
    expect((await client.get('/api/gardens')).status()).toBe(401);
  });

  test('areas and trays: owners add them, viewers read, strangers see nothing', async () => {
    const { owner, viewer, stranger, id } = await property('areas');

    const area = await owner.post(`/api/gardens/${id}/areas`, { data: { kind: 'vegetable' } });
    expect(area.status(), await area.text()).toBe(201);
    expect(
      (await owner.post(`/api/gardens/${id}/areas`, { data: { kind: 'lawn' } })).status(),
    ).toBe(400);
    const areas = (await (await viewer.get(`/api/gardens/${id}/areas`)).json()) as Array<{
      kind: string;
    }>;
    expect(areas.map((a) => a.kind)).toContain('vegetable');

    const tray = await owner.post(`/api/gardens/${id}/trays`, { data: { name: 'Seed tray A' } });
    expect(tray.status(), await tray.text()).toBe(201);
    expect((await owner.post(`/api/gardens/${id}/trays`, { data: { name: ' ' } })).status()).toBe(
      400,
    );
    const trays = (await (await viewer.get(`/api/gardens/${id}/trays`)).json()) as Array<{
      name: string;
    }>;
    expect(trays.map((t) => t.name)).toEqual(['Seed tray A']);

    expect(
      (await viewer.post(`/api/gardens/${id}/trays`, { data: { name: 'Viewer tray' } })).status(),
    ).toBe(403);
    expect(
      (await viewer.post(`/api/gardens/${id}/areas`, { data: { kind: 'fruit' } })).status(),
    ).toBe(403);
    expect((await stranger.get(`/api/gardens/${id}/areas`)).status()).toBe(404);
    expect((await stranger.get(`/api/gardens/${id}/trays`)).status()).toBe(404);
  });

  test('a bed can be renamed and its site set; viewers and strangers cannot', async () => {
    const { owner, viewer, stranger, id } = await property('bedpatch');
    const created = await owner.post(`/api/gardens/${id}/beds`, {
      data: { name: 'North', lengthInches: 96, widthInches: 48 },
    });
    expect(created.status(), await created.text()).toBe(201);
    const bed = (await created.json()) as { id: string };

    const patched = await owner.patch(`/api/gardens/${id}/beds/${bed.id}`, {
      data: { name: 'North raised', sun: 'part', site: 'raised', mulch: 'straw' },
    });
    expect(patched.ok(), await patched.text()).toBe(true);
    expect(await patched.json()).toMatchObject({
      name: 'North raised',
      sun: 'part',
      site: 'raised',
      mulch: 'straw',
    });
    expect(
      (
        await owner.patch(`/api/gardens/${id}/beds/${bed.id}`, {
          data: { name: 'North', mulch: 'gravel' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await viewer.patch(`/api/gardens/${id}/beds/${bed.id}`, { data: { name: 'Mine' } })
      ).status(),
    ).toBe(403);
    expect(
      (
        await stranger.patch(`/api/gardens/${id}/beds/${bed.id}`, { data: { name: 'Mine' } })
      ).status(),
    ).toBe(404);
  });

  test('the transplants list holds loose transplants, not seedlings in a tray', async () => {
    const { owner, stranger, id } = await property('transplants');
    const tomato = await plantId(owner, 'Tomato', 'Cherry');
    type Listed = { plantings: Array<{ id: string; trayId?: string | null }> };

    // A transplant made before the property has a tray is loose.
    const loose = await owner.post(`/api/gardens/${id}/plantings`, {
      data: { plantId: tomato, startMethod: 'transplant', indoorStartedOn: '2026-03-01' },
    });
    expect(loose.status(), await loose.text()).toBe(201);
    const looseId = ((await loose.json()) as Listed).plantings[0]!.id;

    const tray = (await (
      await owner.post(`/api/gardens/${id}/trays`, { data: { name: 'Seed tray A' } })
    ).json()) as { id: string };
    const inTray = await owner.post(`/api/gardens/${id}/plantings`, {
      data: {
        plantId: tomato,
        startMethod: 'transplant',
        indoorStartedOn: '2026-03-02',
        trayId: tray.id,
      },
    });
    expect(inTray.status(), await inTray.text()).toBe(201);

    const list = (await (await owner.get(`/api/gardens/${id}/transplants`)).json()) as Listed;
    expect(list.plantings.map((p) => p.id)).toEqual([looseId]);
    expect((await stranger.get(`/api/gardens/${id}/transplants`)).status()).toBe(404);
  });

  test('a completed task can be undone; viewers cannot', async () => {
    const { owner, viewer, id } = await property('undo');
    const tomato = await plantId(owner, 'Tomato', 'Cherry');
    const created = await owner.post(`/api/gardens/${id}/plantings`, {
      data: { plantId: tomato, plantedOn: '2026-01-01' },
    });
    expect(created.status(), await created.text()).toBe(201);
    const plantingId = ((await created.json()) as { plantings: Array<{ id: string }> })
      .plantings[0]!.id;

    type Items = { items: Array<{ plantingId: string; kind: string; dueOn: string }> };
    const harvests = async () =>
      (
        (await (await owner.get(`/api/gardens/${id}/reminders?asOf=2026-08-17`)).json()) as Items
      ).items.filter((i) => i.plantingId === plantingId && i.kind === 'harvest');
    const [harvest] = await harvests();
    expect(harvest, 'a harvest task is due').toBeTruthy();
    const body = { plantingId, kind: 'harvest', dueOn: harvest!.dueOn };

    expect(
      (await viewer.post(`/api/gardens/${id}/reminders/complete`, { data: body })).status(),
    ).toBe(403);
    expect((await owner.post(`/api/gardens/${id}/reminders/complete`, { data: body })).ok()).toBe(
      true,
    );
    expect(await harvests()).toHaveLength(0);

    expect((await viewer.post(`/api/gardens/${id}/reminders/undo`, { data: body })).status()).toBe(
      403,
    );
    const undo = await owner.post(`/api/gardens/${id}/reminders/undo`, { data: body });
    expect(undo.ok(), await undo.text()).toBe(true);
    expect(await harvests()).toHaveLength(1);
  });

  test('seasons: companion pairs and closing, for owners only', async () => {
    const { owner, viewer, stranger, id } = await property('season');
    const basil = await plantId(owner, 'Basil', 'Genovese');
    const tomato = await plantId(owner, 'Tomato', 'Cherry');
    for (const plant of [basil, tomato]) {
      const res = await owner.post(`/api/gardens/${id}/plantings`, { data: { plantId: plant } });
      expect(res.status(), await res.text()).toBe(201);
    }

    type Season = {
      openYear: number;
      closedYear: number | null;
      pairs: Array<{ plantName: string; otherName: string; kind: string; reason: string }>;
    };
    const season = (await (await owner.get(`/api/gardens/${id}/season`)).json()) as Season;
    expect(season.closedYear).toBeNull();
    expect((await stranger.get(`/api/gardens/${id}/season`)).status()).toBe(404);

    const pair = { plantId: tomato, otherPlantId: basil, kind: 'hinders', reason: 'Shades it' };
    expect(
      (await viewer.post(`/api/gardens/${id}/season/companions`, { data: pair })).status(),
    ).toBe(403);
    expect(
      (
        await owner.post(`/api/gardens/${id}/season/companions`, {
          data: { ...pair, reason: '' },
        })
      ).status(),
    ).toBe(400);
    const added = await owner.post(`/api/gardens/${id}/season/companions`, { data: pair });
    expect(added.ok(), await added.text()).toBe(true);
    const withPair = (await (await owner.get(`/api/gardens/${id}/season`)).json()) as Season;
    expect(withPair.pairs).toContainEqual(
      expect.objectContaining({ kind: 'hinders', reason: 'Shades it' }),
    );

    expect((await viewer.post(`/api/gardens/${id}/season/close`)).status()).toBe(403);
    const closed = await owner.post(`/api/gardens/${id}/season/close`);
    expect(closed.ok(), await closed.text()).toBe(true);
    expect(await closed.json()).toMatchObject({
      openYear: season.openYear + 1,
      closedYear: season.openYear,
    });
  });
});
