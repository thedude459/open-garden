import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient } from './live-http';

describe.skipIf(!liveEnabled)('weather alerts http', () => {
  type Today = {
    alerts?: Array<{
      gardenId: string;
      gardenName: string;
      kind: string;
      date: string;
      tempC: number;
      plantings: Array<{ name: string; bedName: string | null }>;
    }>;
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

  async function plant(client: LiveClient, gardenId: string, name: string, bedId: string | null) {
    const res = await client.post(`/api/gardens/${gardenId}/plantings`, {
      data: { id: crypto.randomUUID(), plantId: await plantId(client, name), bedId },
    });
    expect(res.status(), await res.text()).toBe(201);
  }

  test('Today warns about frost for tender plants in beds only', async () => {
    const owner = new LiveClient();
    const reg = await owner.post('/api/auth/register', {
      data: { email: `weather-${Date.now()}@example.com`, password: 'password123' },
    });
    expect(reg.ok()).toBeTruthy();
    // The fixture forecast has a −2 °C night tomorrow at this address.
    const created = await owner.post('/api/gardens', {
      data: { name: 'Frost plot', place: fixturePlace },
    });
    expect(created.status()).toBe(201);
    const garden = (await created.json()) as { id: string };
    const bedRes = await owner.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    });
    expect(bedRes.status()).toBe(201);
    const bed = (await bedRes.json()) as { id: string };

    const before = (await (await owner.get('/api/gardens/today?asOf=2026-11-17')).json()) as Today;
    expect(before.alerts).toEqual([]);

    await plant(owner, garden.id, 'Tomato', bed.id);
    await plant(owner, garden.id, 'Kale', bed.id);
    await plant(owner, garden.id, 'Tomato', null);

    const today = (await (await owner.get('/api/gardens/today?asOf=2026-11-17')).json()) as Today;
    expect(today.alerts).toEqual([
      {
        gardenId: garden.id,
        gardenName: 'Frost plot',
        kind: 'frost',
        date: '2026-11-18',
        tempC: -2,
        plantings: [{ name: 'Tomato', bedName: 'North' }],
      },
    ]);
  });
});
