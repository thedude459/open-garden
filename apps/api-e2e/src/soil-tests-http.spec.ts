import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('soil tests http', () => {
  type Layout = {
    beds: Array<{ id: string; soilTest?: { id: string; ph: number | null } | null }>;
    plantings: Array<{
      id: string;
      commonName: string;
      soilPh?: { min: number; max: number } | null;
    }>;
  };

  const result = {
    testedOn: '2026-04-01',
    lab: 'State lab',
    ph: 7.2,
    organicMatterPct: 2.5,
    phosphorus: 'low',
    recommendations: 'Add 4 lb bone meal per 100 sq ft',
  };

  async function plantId(client: LiveClient, name: string) {
    const res = await client.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    const body = (await res.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    const plant = body.items.find((p) => p.commonName === name && !p.cultivar);
    expect(plant, `missing plant ${name}`).toBeTruthy();
    return plant!.id;
  }

  test('records a bed’s soil test, carries the latest on the plan, and deletes it', async () => {
    const owner = new LiveClient();
    const stranger = new LiveClient();
    await owner.register(uniqueEmail('soil-owner'));
    await stranger.register(uniqueEmail('soil-stranger'));
    const garden = (await (
      await owner.post('/api/gardens', { data: { name: 'Soil plot', place: fixturePlace } })
    ).json()) as { id: string };
    const bed = (await (
      await owner.post(`/api/gardens/${garden.id}/beds`, {
        data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
      })
    ).json()) as { id: string };
    const tomato = { id: crypto.randomUUID() };
    const planted = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { id: tomato.id, plantId: await plantId(owner, 'Tomato'), bedId: bed.id },
    });
    expect(planted.status()).toBe(201);
    const path = `/api/gardens/${garden.id}/beds/${bed.id}/soil-tests`;

    const empty = await owner.post(path, { data: { testedOn: '2026-04-01' } });
    expect(empty.status()).toBe(400);
    expect(await empty.text()).toContain('Enter at least one result from the test');
    const badPh = await owner.post(path, { data: { ...result, ph: 15 } });
    expect(badPh.status()).toBe(400);
    const future = await owner.post(path, { data: { ...result, testedOn: '2099-01-01' } });
    expect(future.status()).toBe(400);
    const notMine = await stranger.post(path, { data: result });
    expect(notMine.status()).toBe(404);

    const older = await owner.post(path, { data: { ...result, testedOn: '2023-04-01', ph: 6.5 } });
    expect(older.status(), await older.text()).toBe(201);
    const saved = await owner.post(path, { data: result });
    expect(saved.status()).toBe(201);
    const test = (await saved.json()) as { id: string };
    expect(test).toMatchObject({
      bedId: bed.id,
      ph: 7.2,
      organicMatterPct: 2.5,
      nitrogen: null,
      phosphorus: 'low',
      potassium: null,
    });

    const layout = (await (await owner.get(`/api/gardens/${garden.id}/layout`)).json()) as Layout;
    expect(layout.beds.find((b) => b.id === bed.id)?.soilTest).toMatchObject({
      id: test.id,
      ph: 7.2,
    });
    expect(layout.plantings.find((p) => p.id === tomato.id)?.soilPh).toEqual({ min: 6, max: 7 });

    const strangerDelete = await stranger.delete(`${path}/${test.id}`);
    expect(strangerDelete.status()).toBe(404);
    const removed = await owner.delete(`${path}/${test.id}`);
    expect(removed.status()).toBe(200);
    expect(((await removed.json()) as { latest: { ph: number } }).latest).toMatchObject({
      ph: 6.5,
    });
    const again = await owner.delete(`${path}/${test.id}`);
    expect(again.status()).toBe(404);
  });
});
