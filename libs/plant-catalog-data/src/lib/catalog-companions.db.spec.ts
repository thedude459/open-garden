// Repository integration tests against a real PostgreSQL (PGlite): dataset
// companion pairs, how an import replaces them, how the planner sees them
// beside household pairs, and the zones a member's pairs are ranked by.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CatalogCompanionRepository,
  type CatalogCompanionInput,
} from './catalog-companion-repository';
import { GardenRepository } from './garden-repository';
import { PipelineRunRepository, type PublishPlantInput } from './pipeline-run-repository';
import { PlantingRepository } from './planting-repository';
import { createTestDb, gardenInput, insertUser, type TestDb } from './test-db';
import { YearRecordRepository } from './year-record-repository';

let t: TestDb;
let pairs: CatalogCompanionRepository;
let runs: PipelineRunRepository;

beforeAll(async () => {
  t = await createTestDb();
  pairs = new CatalogCompanionRepository(t.db);
  runs = new PipelineRunRepository(t.db);
});
afterAll(() => t.close());

const plant = (key: string, cropId: string, cultivar: string | null = null): PublishPlantInput => ({
  varietyKey: `dataset:${key}`,
  commonName: cropId === 'tomato' ? 'Tomato' : cropId === 'basil' ? 'Basil' : 'Potato',
  species: 'Testus plantus',
  cultivar,
  plantType: 'vegetable',
  zoneMin: 1,
  zoneMax: 13,
  sunRequirements: 'Full sun',
  waterNeeds: 'Moderate',
  daysToMaturity: 60,
  spacingInches: 12,
  provider: 'dataset',
  providerExternalId: key,
  cropId,
  sourceLinks: [{ sourceId: 'dataset', externalId: key }],
});

const basilTomato: CatalogCompanionInput = {
  crops: ['basil', 'tomato'],
  kind: 'helps',
  benefits: ['deters-pests'],
  evidence: 'research',
  reason: 'Basil reduced thrips on tomatoes.',
  reference: 'Mutisya et al. (2016)',
  shownIn: [{ where: 'Greenhouse', zones: null }],
};
const tomatoPotato: CatalogCompanionInput = {
  crops: ['tomato', 'potato'],
  kind: 'hinders',
  benefits: ['shares-pests'],
  evidence: 'extension',
  reason: 'Both get late blight.',
  reference: 'UMN',
  shownIn: [{ where: 'Minnesota, USA', zones: { min: 3, max: 5 } }],
};

async function publish(plants: PublishPlantInput[], companions: CatalogCompanionInput[]) {
  const run = await runs.insertRunning('operator');
  await runs.publish({
    runId: run.id,
    status: 'succeeded',
    errorMessage: null,
    plants,
    deprecateKeys: [],
    companions,
    plantsReactivated: 0,
    recordsRejected: 0,
    sources: [],
    merges: [],
    catalogHash: null,
  });
}

describe('catalog companion pairs', () => {
  it('an import replaces the pairs, and an unchanged run leaves them', async () => {
    const catalog = [
      plant('tomato', 'tomato'),
      plant('tomato-cherry', 'tomato', 'Cherry'),
      plant('basil', 'basil'),
      plant('potato', 'potato'),
    ];
    await publish(catalog, [basilTomato]);
    expect((await pairs.listForCrops(['tomato'])).map((p) => p.cropId)).toEqual(['basil']);

    await publish(catalog, [basilTomato, tomatoPotato]);
    // An unchanged run writes no plants, so it must not wipe the pairs.
    await publish([], []);

    const tomato = await pairs.listForCrops(['tomato']);
    expect(tomato.map((p) => [p.cropId, p.name, p.kind]).sort()).toEqual([
      ['basil', 'Basil', 'helps'],
      ['potato', 'Potato', 'hinders'],
    ]);
    // Seen from basil, the same pair names tomato.
    expect(await pairs.listForCrops(['basil'])).toEqual([
      expect.objectContaining({ cropId: 'tomato', name: 'Tomato', fromCropId: 'basil' }),
    ]);
    expect(await pairs.listForCrops([])).toEqual([]);
  });

  it('the planner sees pairs between planted plants, and a household pair wins', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const plantings = new PlantingRepository(t.db);
    const ids = new Map(
      (
        await t.db.query.plants.findMany({
          columns: { id: true, varietyKey: true },
        })
      ).map((row) => [row.varietyKey, row.id]),
    );
    const plantOf = async (key: string) =>
      plantings.insert({
        gardenId: garden.id,
        plantId: ids.get(`dataset:${key}`)!,
        bedId: null,
        plantedOn: null,
        harvestedOn: null,
      });
    await plantOf('tomato-cherry');
    await plantOf('basil');
    await plantOf('potato');

    const seasons = new YearRecordRepository(t.db);
    let advice = await seasons.layoutAdvice(garden.id);
    // The cherry tomato carries tomato's pairs.
    expect(advice.pairs.map((p) => [p.plantName, p.otherName, p.kind]).sort()).toEqual([
      ['Basil', 'Tomato', 'helps'],
      ['Tomato', 'Potato', 'hinders'],
    ]);

    await seasons.addPair({
      gardenId: garden.id,
      plantId: ids.get('dataset:potato')!,
      otherPlantId: ids.get('dataset:tomato-cherry')!,
      kind: 'helps',
      reason: 'Our own experience',
    });
    advice = await seasons.layoutAdvice(garden.id);
    expect(advice.pairs.map((p) => [p.plantName, p.otherName, p.kind, p.reason]).sort()).toEqual([
      ['Basil', 'Tomato', 'helps', 'Basil reduced thrips on tomatoes.'],
      ['Potato', 'Tomato', 'helps', 'Our own experience'],
    ]);
  });

  it('lists the hardiness zones of a member’s properties', async () => {
    const owner = await insertUser(t.db);
    const gardens = new GardenRepository(t.db);
    await gardens.createOwned({ ...gardenInput(owner.id), hardinessZone: 5 });
    await gardens.createOwned({ ...gardenInput(owner.id), hardinessZone: 5 });
    await gardens.createOwned(gardenInput(owner.id));
    expect(await gardens.zonesForUser(owner.id)).toEqual([5]);
  });
});
