import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

type Planting = {
  id: string;
  harvestedOn: string | null;
  harvests: { harvestedOn: string; grams: number | null; count: number | null }[];
};

describe.skipIf(!liveEnabled)('harvests http (ADR 0038)', () => {
  async function plantTomato(owner: LiveClient, gardenId: string) {
    const search = await owner.get('/api/plants?q=Tomato&pageSize=20');
    const plant = (
      (await search.json()) as { items: { id: string; cultivar: string | null }[] }
    ).items.find((p) => !p.cultivar)!;
    const created = await owner.post(`/api/gardens/${gardenId}/plantings`, {
      data: { id: crypto.randomUUID(), plantId: plant.id, plantedOn: '2026-05-01' },
    });
    expect(created.status()).toBe(201);
    return ((await created.json()) as { plantings: { id: string }[] }).plantings[0]!.id;
  }

  test('logs harvests, adds a second pick that day, totals by crop, and deletes one', async () => {
    const owner = new LiveClient();
    const viewer = new LiveClient();
    const stranger = new LiveClient();
    await owner.register(uniqueEmail('harvest-owner'));
    const viewerUser = await viewer.register(uniqueEmail('harvest-viewer'));
    await stranger.register(uniqueEmail('harvest-stranger'));
    const garden = (await (
      await owner.post('/api/gardens', { data: { place: fixturePlace, name: 'Harvest plot' } })
    ).json()) as { id: string };
    await owner.post(`/api/gardens/${garden.id}/members`, {
      data: { email: viewerUser.email, role: 'viewer' },
    });
    const id = await plantTomato(owner, garden.id);
    const log = (client: LiveClient, data: unknown) =>
      client.post(`/api/gardens/${garden.id}/plantings/${id}/harvests`, { data });

    expect((await log(owner, { harvestedOn: '2026-07-01', grams: 600 })).status()).toBe(201);
    const second = await log(owner, { harvestedOn: '2026-07-01', grams: 400, count: 3 });
    expect(((await second.json()) as Planting).harvests).toEqual([
      { harvestedOn: '2026-07-01', grams: 1000, count: 3 },
    ]);
    expect((await log(owner, { harvestedOn: '2026-07-08', count: 5 })).status()).toBe(201);
    expect((await log(owner, { harvestedOn: '2026-04-01' })).status()).toBe(400);
    expect((await log(owner, { harvestedOn: '2026-07-09', grams: -5 })).status()).toBe(400);
    expect((await log(viewer, { harvestedOn: '2026-07-09' })).status()).toBe(403);

    const totals = await viewer.get(`/api/gardens/${garden.id}/harvests`);
    expect(totals.status()).toBe(200);
    expect(await totals.json()).toMatchObject({
      seasonYear: 2026,
      seasons: [2026],
      crops: [{ name: 'Tomato', grams: 1000, count: 8 }],
    });
    expect(
      (
        (await (await owner.get(`/api/gardens/${garden.id}/harvests?season=2025`)).json()) as {
          crops: unknown[];
        }
      ).crops,
    ).toEqual([]);
    expect((await owner.get(`/api/gardens/${garden.id}/harvests?season=soon`)).status()).toBe(400);
    expect((await stranger.get(`/api/gardens/${garden.id}/harvests`)).status()).toBe(404);

    const removed = await owner.delete(
      `/api/gardens/${garden.id}/plantings/${id}/harvests/2026-07-08`,
    );
    expect(((await removed.json()) as Planting).harvests.map((h) => h.harvestedOn)).toEqual([
      '2026-07-01',
    ]);
    expect(
      (await owner.delete(`/api/gardens/${garden.id}/plantings/${id}/harvests/July`)).status(),
    ).toBe(400);
  });
});
