// Repository integration tests against a real PostgreSQL (PGlite): catalog
// pipeline runs, publishing, the unchanged-catalog hash, and history pruning.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PipelineRunRepository,
  RUN_HISTORY,
  type PublishPlantInput,
} from './pipeline-run-repository';
import { PlantRepository } from './plant-repository';
import { catalogPipelineRuns } from './schema';
import { createTestDb, type TestDb } from './test-db';

let t: TestDb;
let runs: PipelineRunRepository;

beforeAll(async () => {
  t = await createTestDb();
  runs = new PipelineRunRepository(t.db);
});
afterAll(() => t.close());

const plant = (key: string, over: Partial<PublishPlantInput> = {}): PublishPlantInput => ({
  varietyKey: key,
  commonName: `Name ${key}`,
  species: 'Testus plantus',
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 1,
  zoneMax: 13,
  sunRequirements: 'Full sun',
  waterNeeds: 'Moderate',
  daysToMaturity: 60,
  spacingInches: 12,
  provider: 'dataset',
  providerExternalId: key,
  sourceLinks: [{ sourceId: 'dataset', externalId: key }],
  ...over,
});

async function publish(over: Partial<Parameters<PipelineRunRepository['publish']>[0]> = {}) {
  const run = await runs.insertRunning('operator');
  await runs.publish({
    runId: run.id,
    status: 'succeeded',
    errorMessage: null,
    plants: [],
    deprecateKeys: [],
    plantsReactivated: 0,
    recordsRejected: 0,
    sources: [
      {
        sourceId: 'dataset',
        status: 'succeeded',
        recordsAccepted: 0,
        recordsRejected: 0,
        errorMessage: null,
      },
    ],
    merges: [],
    catalogHash: null,
    ...over,
  });
  return run.id;
}

describe('PipelineRunRepository', () => {
  it('allows one running run at a time and sweeps stale ones', async () => {
    const run = await runs.insertRunning('operator');
    await expect(runs.insertRunning('operator')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await runs.failStaleRunning('restart')).toBe(1);
    expect(await runs.getById(run.id)).toMatchObject({ status: 'failed', errorMessage: 'restart' });
  });

  it('publishes plants, sources, and merge decisions, and records the catalog hash', async () => {
    const id = await publish({
      plants: [plant('dataset:a'), plant('dataset:b')],
      merges: [
        {
          varietyKey: 'dataset:a',
          contributingSources: ['dataset'],
          fieldWinners: { commonName: 'dataset' },
        },
      ],
      catalogHash: 'hash-1',
    });
    expect(await runs.getById(id)).toMatchObject({ status: 'succeeded', plantsUpserted: 2 });
    const detail = await runs.getDetail(id);
    expect(detail?.sources).toHaveLength(1);
    expect(detail?.merges).toHaveLength(1);
    expect(await runs.latestPublishedHash()).toBe('hash-1');
    expect((await new PlantRepository(t.db).listSnapshots()).map((s) => s.varietyKey)).toEqual(
      expect.arrayContaining(['dataset:a', 'dataset:b']),
    );
  });

  it('deprecates the given keys and ignores the hash of runs that did not succeed', async () => {
    await publish({ plants: [plant('dataset:gone')], catalogHash: 'hash-2' });
    const id = await publish({
      status: 'incomplete',
      deprecateKeys: ['dataset:gone'],
      catalogHash: null,
    });
    expect(await runs.getById(id)).toMatchObject({ status: 'incomplete', plantsDeprecated: 1 });
    expect(await runs.latestPublishedHash()).toBe('hash-2');
  });

  it('marks a run terminal only while it is running', async () => {
    const run = await runs.insertRunning('operator');
    await runs.markTerminal(run.id, { status: 'failed', errorMessage: 'No sources' });
    await runs.markTerminal(run.id, { status: 'succeeded', errorMessage: null });
    expect(await runs.getById(run.id)).toMatchObject({
      status: 'failed',
      errorMessage: 'No sources',
    });
    expect((await runs.list(1, 5)).items.length).toBeGreaterThan(0);
  });

  it('prunes runs that are both old and outside the latest, with their history', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - (RUN_HISTORY.keepDays + 1) * 86_400_000);
    const oldId = await publish();
    await t.db
      .update(catalogPipelineRuns)
      .set({ startedAt: old })
      .where(eq(catalogPipelineRuns.id, oldId));
    // Enough newer runs to push the old one out of the latest window.
    for (let i = 0; i < RUN_HISTORY.keepLatest; i++) await publish();
    // Each publish prunes, so the old run is already gone; a second prune finds nothing.
    expect(await runs.pruneHistory(now)).toBe(0);
    expect(await runs.getById(oldId)).toBeNull();
    expect(await runs.getDetail(oldId)).toBeNull();
    // The latest runs stay, however old.
    expect((await runs.list(1, 100)).totalCount).toBeGreaterThanOrEqual(RUN_HISTORY.keepLatest);
  });
});
