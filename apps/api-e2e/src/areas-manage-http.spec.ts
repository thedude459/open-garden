import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('areas http: rename, delete, move a bed', () => {
  type Area = { id: string; name: string; kind: string };

  async function plantId(client: LiveClient, name: string) {
    const res = await client.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    const body = (await res.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    const plant = body.items.find((p) => p.commonName === name && !p.cultivar);
    expect(plant, `missing plant ${name}`).toBeTruthy();
    return plant!.id;
  }

  test('renames an area, moves a bed only where its plants belong, and deletes an empty area', async () => {
    const owner = new LiveClient();
    const viewer = new LiveClient();
    const stranger = new LiveClient();
    await owner.register(uniqueEmail('areas-owner'));
    const viewerUser = await viewer.register(uniqueEmail('areas-viewer'));
    await stranger.register(uniqueEmail('areas-stranger'));
    const garden = (await (
      await owner.post('/api/gardens', { data: { name: 'Areas plot', place: fixturePlace } })
    ).json()) as { id: string };
    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: viewerUser.email, role: 'viewer' },
    });
    const bed = (await (
      await owner.post(`/api/gardens/${garden.id}/beds`, {
        data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
      })
    ).json()) as { id: string; areaId: string };
    const second = (await (
      await owner.post(`/api/gardens/${garden.id}/areas`, { data: { kind: 'vegetable' } })
    ).json()) as Area;
    const canes = (await (
      await owner.post(`/api/gardens/${garden.id}/areas`, { data: { kind: 'bramble' } })
    ).json()) as Area;
    const planted = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { id: crypto.randomUUID(), plantId: await plantId(owner, 'Tomato'), bedId: bed.id },
    });
    expect(planted.status()).toBe(201);
    const areaPath = (id: string) => `/api/gardens/${garden.id}/areas/${id}`;

    // Rename: unique within the property; viewers and strangers refused.
    const renamed = await owner.patch(areaPath(second.id), { data: { name: 'Back garden' } });
    expect(renamed.status(), await renamed.text()).toBe(200);
    expect(await renamed.json()).toMatchObject({ id: second.id, name: 'Back garden' });
    expect(
      (await owner.patch(areaPath(second.id), { data: { name: 'bramble PATCH' } })).status(),
    ).toBe(409);
    expect((await owner.patch(areaPath(second.id), { data: { name: ' ' } })).status()).toBe(400);
    expect((await viewer.patch(areaPath(second.id), { data: { name: 'X' } })).status()).toBe(403);
    expect((await stranger.patch(areaPath(second.id), { data: { name: 'X' } })).status()).toBe(404);

    // Move: a tomato bed may go to another vegetable garden, not a bramble patch.
    const bedPath = `/api/gardens/${garden.id}/beds/${bed.id}`;
    const refused = await owner.patch(bedPath, { data: { name: 'North', areaId: canes.id } });
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain('Bramble patch will not take this bed');
    const moved = await owner.patch(bedPath, { data: { name: 'North', areaId: second.id } });
    expect(moved.status(), await moved.text()).toBe(200);
    expect(await moved.json()).toMatchObject({ areaId: second.id, station: null });
    const layout = (await (await owner.get(`/api/gardens/${garden.id}/layout`)).json()) as {
      beds: Array<{ id: string; areaId: string | null }>;
    };
    expect(layout.beds.find((b) => b.id === bed.id)?.areaId).toBe(second.id);

    // Delete: refused while the area holds the bed; the old one is now empty.
    const busy = await owner.delete(areaPath(second.id));
    expect(busy.status()).toBe(409);
    expect(await busy.text()).toContain('Back garden still holds 1 bed');
    expect((await viewer.delete(areaPath(bed.areaId))).status()).toBe(403);
    expect((await owner.delete(areaPath(bed.areaId))).status()).toBe(204);
    const areas = (await (await owner.get(`/api/gardens/${garden.id}/areas`)).json()) as Area[];
    expect(areas.map((a) => a.name).sort()).toEqual(['Back garden', 'Bramble patch']);
  });
});
