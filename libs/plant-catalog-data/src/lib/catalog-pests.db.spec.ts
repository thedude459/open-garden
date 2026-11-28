// Repository integration tests against a real PostgreSQL (PGlite): dataset
// pests, how an import replaces them, the crops they are found by, and the
// places a member's pest guidance is chosen for.
import type { CatalogPestDto } from '@open-garden/shared-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CareEventRepository } from './care-event-repository';
import { CatalogPestRepository } from './catalog-pest-repository';
import { GardenRepository } from './garden-repository';
import { PipelineRunRepository, type PublishPlantInput } from './pipeline-run-repository';
import { createTestDb, gardenInput, insertUser, type TestDb } from './test-db';

let t: TestDb;
let pests: CatalogPestRepository;
let runs: PipelineRunRepository;

beforeAll(async () => {
  t = await createTestDb();
  pests = new CatalogPestRepository(t.db);
  runs = new PipelineRunRepository(t.db);
});
afterAll(() => t.close());

const potato: PublishPlantInput = {
  varietyKey: 'dataset:potato',
  commonName: 'Potato',
  species: 'Solanum tuberosum',
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 1,
  zoneMax: 13,
  sunRequirements: 'Full sun',
  waterNeeds: 'Moderate',
  daysToMaturity: 90,
  spacingInches: 12,
  provider: 'dataset',
  providerExternalId: 'potato',
  cropId: 'potato',
  sourceLinks: [{ sourceId: 'dataset', externalId: 'potato' }],
};

const none = { cultural: [], physical: [], biological: [], organic: [], conventional: [] };
const beetle: CatalogPestDto = {
  id: 'colorado-potato-beetle',
  name: 'Colorado potato beetle',
  aliases: ['potato bug'],
  scientificName: 'Leptinotarsa decemlineata',
  kind: 'insect',
  crops: ['potato', 'eggplant'],
  signs: 'Striped beetles and red larvae eat leaves.',
  scoutStages: ['seedling', 'vegetative'],
  controls: { ...none, physical: ['Hand-pick.'] },
  occursIn: ['US', 'CA'],
  regions: [
    {
      where: 'Minnesota, USA',
      country: 'US',
      zones: { min: 3, max: 5 },
      when: 'Late spring.',
      threshold: null,
      controls: { ...none, organic: ['Spinosad.'] },
      reference: 'UMN Extension',
    },
  ],
};
const aphids: CatalogPestDto = { ...beetle, id: 'aphids', name: 'Aphids', crops: ['lettuce'] };

async function publish(plants: PublishPlantInput[], list: CatalogPestDto[] | undefined) {
  const run = await runs.insertRunning('operator');
  await runs.publish({
    runId: run.id,
    status: 'succeeded',
    errorMessage: null,
    plants,
    deprecateKeys: [],
    companions: [],
    ...(list ? { pests: list } : {}),
    plantsReactivated: 0,
    recordsRejected: 0,
    sources: [],
    merges: [],
    catalogHash: null,
  });
}

describe('catalog pests', () => {
  it('an import replaces the pests, and an unchanged run leaves them', async () => {
    await publish([potato], [beetle, aphids]);
    expect(await pests.listForCrops(['potato'])).toEqual([beetle]);
    expect((await pests.listForCrops(['potato', 'lettuce'])).map((p) => p.id)).toEqual([
      'aphids',
      'colorado-potato-beetle',
    ]);
    // Nothing to write: the pests stay.
    await publish([], undefined);
    expect(await pests.listForCrops(['lettuce'])).toHaveLength(1);
    // A new catalog without aphids drops them.
    await publish([potato], [beetle]);
    expect(await pests.listForCrops(['lettuce'])).toEqual([]);
    expect(await pests.listForCrops([])).toEqual([]);
  });

  it('lists the country and zone of each property a member belongs to', async () => {
    const owner = await insertUser(t.db);
    const gardens = new GardenRepository(t.db);
    await gardens.createOwned({ ...gardenInput(owner.id), countryCode: 'US', hardinessZone: 5 });
    await gardens.createOwned({ ...gardenInput(owner.id), countryCode: 'US', hardinessZone: 5 });
    await gardens.createOwned(gardenInput(owner.id));
    expect(
      (await gardens.placesForUser(owner.id)).sort((a, b) => (a.zone ?? 0) - (b.zone ?? 0)),
    ).toEqual([
      { country: null, zone: null },
      { country: 'US', zone: 5 },
    ]);
    expect(await gardens.placesForUser((await insertUser(t.db)).id)).toEqual([]);
  });

  it('names catalog pests by id, and keeps a property’s not-a-problem pests (ADR 0047)', async () => {
    await publish([potato], [beetle, aphids]);
    expect(await pests.namesFor(['colorado-potato-beetle', 'aphids', 'dragons'])).toEqual([
      { id: 'aphids', name: 'Aphids' },
      { id: 'colorado-potato-beetle', name: 'Colorado potato beetle' },
    ]);
    expect(await pests.namesFor([])).toEqual([]);

    const owner = await insertUser(t.db);
    const gardens = new GardenRepository(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    const other = await gardens.createOwned(gardenInput(owner.id));
    const care = new CareEventRepository(t.db);
    await care.ignorePest(garden.id, 'aphids');
    await care.ignorePest(garden.id, 'aphids');
    await care.ignorePest(other.id, 'colorado-potato-beetle');
    expect(await care.listIgnoredPests(garden.id)).toEqual(['aphids']);
    await care.restorePest(garden.id, 'aphids');
    expect(await care.listIgnoredPests(garden.id)).toEqual([]);
    expect(await care.listIgnoredPests(other.id)).toEqual(['colorado-potato-beetle']);
  });
});
