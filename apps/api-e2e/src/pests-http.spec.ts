// Live HTTP test for pest advice on plant pages (ADR 0045): the bundled
// catalog's pests reach the plant detail, with guidance for the member's
// country once a property has one.
import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('pests http', () => {
  type Pest = {
    id: string;
    regionMatch: string;
    controls: { organic: string[]; conventional: string[] };
    region: { country: string; controls: { organic: string[] } } | null;
  };

  test("a plant's pests come with guidance for the member's country", async () => {
    const client = new LiveClient();
    await client.register(uniqueEmail('pests'));
    const search = await client.get('/api/plants?q=Potato&pageSize=20');
    expect(search.ok()).toBe(true);
    const { items } = (await search.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    const potato = items.find((p) => p.commonName === 'Potato' && p.cultivar === null);
    expect(potato, 'Potato in the catalog').toBeTruthy();
    const pests = async () =>
      ((await (await client.get(`/api/plants/${potato!.id}`)).json()) as { pests: Pest[] }).pests;

    // No property yet: the nearest region, labelled as such.
    const before = await pests();
    const beetle = before.find((p) => p.id === 'colorado-potato-beetle');
    expect(beetle?.regionMatch).toBe('nearest');
    // Products are only regional.
    expect(before.every((p) => !p.controls.organic.length && !p.controls.conventional.length)).toBe(
      true,
    );

    const created = await client.post('/api/gardens', {
      data: { place: fixturePlace, name: `Pest plot ${Date.now()}` },
    });
    expect(created.status(), await created.text()).toBe(201);
    const after = (await pests()).find((p) => p.id === 'colorado-potato-beetle');
    expect(after).toMatchObject({ regionMatch: 'country', region: { country: 'US' } });
    expect(after?.region?.controls.organic.length).toBeGreaterThan(0);
  });

  test('a bed gets a weekly Scout task naming the pests for its crops (ADR 0046)', async () => {
    const owner = new LiveClient();
    const stranger = new LiveClient();
    await owner.register(uniqueEmail('scout'));
    await stranger.register(uniqueEmail('scout-stranger'));
    const garden = (await (
      await owner.post('/api/gardens', {
        data: { place: fixturePlace, name: `Scout plot ${Date.now()}` },
      })
    ).json()) as { id: string };
    const bed = (await (
      await owner.post(`/api/gardens/${garden.id}/beds`, {
        data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
      })
    ).json()) as { id: string };
    const search = (await (await owner.get('/api/plants?q=Potato&pageSize=20')).json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    };
    const potato = search.items.find((p) => p.commonName === 'Potato' && !p.cultivar)!;
    const now = new Date();
    const asOf = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const id = crypto.randomUUID();
    const planted = await owner.post(`/api/gardens/${garden.id}/plantings`, {
      data: { id, plantId: potato.id, bedId: bed.id },
    });
    expect(planted.status(), await planted.text()).toBe(201);
    expect(
      (
        await owner.patch(`/api/gardens/${garden.id}/plantings/${id}`, {
          data: { plantedOn: asOf },
        })
      ).ok(),
    ).toBe(true);

    type Item = {
      plantingId: string;
      kind: string;
      dueOn: string;
      bedName: string;
      pests?: Array<{ id: string; name: string }>;
    };
    const scouts = async () =>
      (
        (await (await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)).json()) as {
          items: Item[];
        }
      ).items.filter((i) => i.kind === 'scout');
    // Seedlings in the US: the beetle and flea beetles, and aphids; not yet blight.
    expect(await scouts()).toEqual([
      expect.objectContaining({
        plantingId: bed.id,
        bedName: 'North',
        dueOn: asOf,
        pests: [
          { id: 'aphids', name: 'Aphids' },
          { id: 'colorado-potato-beetle', name: 'Colorado potato beetle' },
          { id: 'flea-beetles', name: 'Flea beetles' },
        ],
      }),
    ]);

    const body = { plantingId: bed.id, kind: 'scout', dueOn: asOf };
    const path = `/api/gardens/${garden.id}/reminders/complete`;
    expect((await stranger.post(path, { data: body })).status()).toBe(404);
    expect((await owner.post(path, { data: body })).status()).toBe(204);
    const [next] = await scouts();
    expect((next?.dueOn ?? '') > asOf).toBe(true);
    expect(
      (await owner.post(`/api/gardens/${garden.id}/reminders/undo`, { data: body })).status(),
    ).toBe(204);
    expect((await scouts())[0]?.dueOn).toBe(asOf);

    // Not a problem here: the beetle leaves this property's Scout task (ADR 0047).
    const pest = (action: string, client: LiveClient, pestId: string) =>
      client.post(`/api/gardens/${garden.id}/reminders/${action}`, { data: { pestId } });
    expect((await pest('ignore-pest', owner, 'Not An Id')).status()).toBe(400);
    expect((await pest('ignore-pest', owner, 'no-such-pest')).status()).toBe(404);
    expect((await pest('ignore-pest', stranger, 'colorado-potato-beetle')).status()).toBe(404);
    expect((await pest('ignore-pest', owner, 'colorado-potato-beetle')).status()).toBe(204);
    expect((await scouts())[0]?.pests?.map((p) => p.id)).toEqual(['aphids', 'flea-beetles']);
    const list = (await (
      await owner.get(`/api/gardens/${garden.id}/reminders?asOf=${asOf}`)
    ).json()) as { ignoredPests: Array<{ id: string }> };
    expect(list.ignoredPests).toEqual([
      { id: 'colorado-potato-beetle', name: 'Colorado potato beetle' },
    ]);
    expect((await pest('restore-pest', owner, 'colorado-potato-beetle')).status()).toBe(204);
    expect((await scouts())[0]?.pests).toHaveLength(3);
  });
});
