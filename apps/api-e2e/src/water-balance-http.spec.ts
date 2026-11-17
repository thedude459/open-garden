import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('watering by water balance http', () => {
  type Item = {
    plantingId: string;
    kind: string;
    dueOn: string;
    urgency: string;
    intervalDays: number | null;
    deficitMm?: number | null;
  };

  function shift(iso: string, days: number) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function plantId(client: LiveClient, name: string) {
    const res = await client.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    const body = (await res.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    const plant = body.items.find((p) => p.commonName === name && !p.cultivar);
    expect(plant, `missing plant ${name}`).toBeTruthy();
    return plant!.id;
  }

  test('a tomato in a bed is due to water when the soil is 25 mm short; out of a bed it keeps its interval', async () => {
    const owner = new LiveClient();
    await owner.register(uniqueEmail('water-balance'));
    const garden = (await (
      await owner.post('/api/gardens', { data: { name: 'Water plot', place: fixturePlace } })
    ).json()) as { id: string };
    const bed = (await (
      await owner.post(`/api/gardens/${garden.id}/beds`, {
        data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
      })
    ).json()) as { id: string };
    const asOf = new Date().toISOString().slice(0, 10);
    const plantedOn = shift(asOf, -20);
    const tomato = await plantId(owner, 'Tomato');
    const inBed = crypto.randomUUID();
    const loose = crypto.randomUUID();
    for (const [id, bedId] of [
      [inBed, bed.id],
      [loose, null],
    ] as const) {
      const res = await owner.post(`/api/gardens/${garden.id}/plantings`, {
        data: { id, plantId: tomato, bedId, plantedOn },
      });
      expect(res.status(), await res.text()).toBe(201);
    }

    const list = async () =>
      (await (await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)).json()) as {
        outlookOn: string | null;
        items: Item[];
      };
    const before = await list();
    expect(before.outlookOn).toBe(asOf);
    // The fixture's 4 mm of ET₀ a day × Kc 0.6 (initial stage): 2.4 mm a day, 26.4 mm on day 11.
    expect(before.items.find((i) => i.plantingId === inBed && i.kind === 'water')).toMatchObject({
      dueOn: shift(plantedOn, 11),
      urgency: 'overdue',
      intervalDays: null,
      deficitMm: 26,
    });
    const looseWater = before.items.find((i) => i.plantingId === loose && i.kind === 'water');
    expect(looseWater?.intervalDays).toBeGreaterThan(0);
    expect(looseWater?.deficitMm ?? null).toBeNull();

    // Watered today: at 2.4 mm a day the soil stays above the threshold through the forecast.
    const done = await owner.post(`/api/gardens/${garden.id}/reminders/complete`, {
      data: { plantingId: inBed, kind: 'water', dueOn: shift(plantedOn, 11) },
    });
    expect(done.status(), await done.text()).toBe(204);
    const after = await list();
    expect(after.items.filter((i) => i.plantingId === inBed && i.kind === 'water')).toEqual([]);
  });
});
