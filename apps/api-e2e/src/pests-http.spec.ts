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
});
