import { describe, expect, it } from 'vitest';
import { hashCatalog } from './catalog-pipeline-service';
import { PIPELINE_ERRORS } from './domain-error';
import { MemoryPipeline, MemoryProvider, samplePlant } from './test-memory';

describe('CatalogPipelineService', () => {
  it('runAndWait persists every plant from a fixture-like provider', async () => {
    const plants = Array.from({ length: 12 }, (_, i) =>
      samplePlant({
        externalId: `n-${i}`,
        commonName: `Named ${i}`,
        species: `Named species ${i}`,
      }),
    );
    const mem = new MemoryPipeline();
    const svc = mem.service([new MemoryProvider('a', plants)]);
    const run = await svc.runAndWait();
    expect(run.status).toBe('succeeded');
    expect(run.plantsUpserted).toBe(12);
    expect(mem.plants.size).toBe(12);
  });

  it('counts records a source skipped as rejected, and imports the rest', async () => {
    const mem = new MemoryPipeline();
    const plant = samplePlant({
      externalId: 'ok',
      commonName: 'Readable',
      species: 'Readable species',
    });
    const svc = mem.service([
      {
        id: 'a',
        searchByName: async () => [],
        listPage: async () => ({ items: [plant], skipped: 2 }),
      },
    ]);
    const run = await svc.runAndWait();
    expect(run.status).toBe('succeeded');
    expect(run.plantsUpserted).toBe(1);
    expect(run.recordsRejected).toBe(2);
    expect(run.sources[0]).toMatchObject({ recordsAccepted: 1, recordsRejected: 2 });
  });

  describe('an unchanged catalog', () => {
    const plants = () =>
      [1, 2, 3].map((i) =>
        samplePlant({
          externalId: `u-${i}`,
          commonName: `Same ${i}`,
          species: `Same species ${i}`,
        }),
      );

    it('writes nothing on a second identical run and says so', async () => {
      const mem = new MemoryPipeline();
      const svc = mem.service([new MemoryProvider('a', plants())]);
      expect((await svc.runAndWait()).plantsUpserted).toBe(3);
      const second = await svc.runAndWait();
      expect(second).toMatchObject({ status: 'succeeded', plantsUpserted: 0 });
      expect(second.errorMessage).toMatch(/Catalog unchanged since the last run/);
      expect(mem.plants.size).toBe(3);
    });

    it('writes again when the catalog changes', async () => {
      const mem = new MemoryPipeline();
      const provider = new MemoryProvider('a', plants());
      const svc = mem.service([provider]);
      await svc.runAndWait();
      provider.plants[0] = { ...provider.plants[0]!, daysToMaturity: 99 };
      expect((await svc.runAndWait()).plantsUpserted).toBe(3);
    });

    it('still reactivates a plant deprecated since the last run', async () => {
      const mem = new MemoryPipeline();
      const svc = mem.service([new MemoryProvider('a', plants())]);
      await svc.runAndWait();
      const first = [...mem.plants.values()][0]!;
      first.status = 'deprecated';
      const again = await svc.runAndWait();
      expect(again).toMatchObject({ plantsReactivated: 1, plantsUpserted: 3 });
      expect(mem.plants.get(first.varietyKey)?.status).toBe('active');
    });

    it('does not compare against a run that was incomplete', async () => {
      const mem = new MemoryPipeline();
      const broken = {
        id: 'broken',
        searchByName: async () => [],
        listPage: async (): Promise<never> => {
          throw new Error('down');
        },
      };
      const svc = mem.service([new MemoryProvider('a', plants()), broken]);
      expect((await svc.runAndWait()).status).toBe('incomplete');
      expect((await svc.runAndWait()).plantsUpserted).toBe(3);
    });
  });

  it('hashes a catalog the same way whatever order the plants arrive in', () => {
    const a = { varietyKey: 'a' };
    const b = { varietyKey: 'b' };
    expect(hashCatalog([a, b])).toBe(hashCatalog([b, a]));
    expect(hashCatalog([a])).not.toBe(hashCatalog([b]));
  });

  it('leaves the catalog unchanged when every source fails', async () => {
    const mem = new MemoryPipeline();
    mem.plants.set('keep|', {
      varietyKey: 'keep|',
      commonName: 'Keep',
      species: 'Keep species',
      cultivar: null,
      plantType: 'herb',
      zoneMin: 3,
      zoneMax: 9,
      sunRequirements: null,
      waterNeeds: null,
      daysToMaturity: null,
      spacingInches: null,
      provider: 'a',
      providerExternalId: 'k',
      id: 'plant-keep',
      status: 'active',
      sourceLinks: [{ sourceId: 'a', externalId: 'k' }],
    });
    const svc = mem.service([
      new MemoryProvider('a', [], new Error('timeout api_key=super-secret-token')),
    ]);
    const run = await svc.runAndWait();
    expect(run.status).toBe('failed');
    expect(mem.plants.size).toBe(1);
    expect(run.errorMessage).not.toMatch(/super-secret-token/);
    expect(run.errorMessage).toMatch(/redacted|timeout/i);
  });

  it('deprecates only when every previously contributing source succeeded and omitted the key', async () => {
    const mem = new MemoryPipeline();
    const first = mem.service([
      new MemoryProvider('a', [
        samplePlant({ commonName: 'Stay', species: 'Stay species', externalId: 's' }),
        samplePlant({ commonName: 'Gone', species: 'Gone species', externalId: 'g' }),
      ]),
      new MemoryProvider('b', [
        samplePlant({ commonName: 'Stay', species: 'Stay species', externalId: 'bs' }),
      ]),
    ]);
    await first.runAndWait();
    expect(mem.plants.get('gone species|')?.status).toBe('active');

    const second = mem.service([
      new MemoryProvider('a', [
        samplePlant({ commonName: 'Stay', species: 'Stay species', externalId: 's' }),
      ]),
      new MemoryProvider('b', [
        samplePlant({ commonName: 'Stay', species: 'Stay species', externalId: 'bs' }),
      ]),
    ]);
    const run = await second.runAndWait();
    expect(mem.plants.get('gone species|')?.status).toBe('deprecated');
    expect(run.plantsDeprecated).toBe(1);
  });

  it('does not deprecate plants from a failed source or an empty successful source', async () => {
    const mem = new MemoryPipeline();
    await mem
      .service([
        new MemoryProvider('a', [
          samplePlant({ commonName: 'Only', species: 'Only species', externalId: 'o' }),
        ]),
      ])
      .runAndWait();

    const failedB = await mem
      .service([
        new MemoryProvider('a', [
          samplePlant({ commonName: 'Only', species: 'Only species', externalId: 'o' }),
        ]),
        new MemoryProvider('b', [], new Error('vendor down')),
      ])
      .runAndWait();
    expect(failedB.status).toBe('incomplete');
    expect(mem.plants.get('only species|')?.status).toBe('active');

    const emptyA = await mem
      .service([new MemoryProvider('a', []), new MemoryProvider('b', [])])
      .runAndWait();
    expect(emptyA.status).toBe('succeeded');
    expect(mem.plants.get('only species|')?.status).toBe('active');
  });

  it('reactivates a deprecated variety in place and refreshes attributes', async () => {
    const mem = new MemoryPipeline();
    const provider = new MemoryProvider('a', [
      samplePlant({
        commonName: 'Cycle',
        species: 'Cycle species',
        waterNeeds: 'Low',
        externalId: 'c1',
      }),
    ]);
    const svc = mem.service([provider]);
    await svc.runAndWait();
    const id = mem.plants.get('cycle species|')?.id;
    mem.plants.get('cycle species|')!.status = 'deprecated';

    provider.plants = [
      samplePlant({
        commonName: 'Cycle',
        species: 'Cycle species',
        waterNeeds: 'High',
        externalId: 'c1',
      }),
    ];
    const run = await svc.runAndWait();
    const row = mem.plants.get('cycle species|');
    expect(row?.id).toBe(id);
    expect(row?.status).toBe('active');
    expect(row?.waterNeeds).toBe('High');
    expect(run.plantsReactivated).toBe(1);
    expect(mem.plants.size).toBe(1);
  });

  it('rejects a second start while a run is running', async () => {
    const mem = new MemoryPipeline();
    const svc = mem.service([]);
    await svc.start();
    await expect(svc.start()).rejects.toMatchObject({
      code: 'CONFLICT',
      message: PIPELINE_ERRORS.alreadyRunning().message,
    });
  });

  it('sweeps stale running rows to failed', async () => {
    const mem = new MemoryPipeline();
    const svc = mem.service([]);
    const run = await svc.start();
    const n = await svc.failStaleRunning();
    expect(n).toBe(1);
    expect((await mem.runsPort.getById(run.id))?.status).toBe('failed');
    expect((await mem.runsPort.getById(run.id))?.errorMessage).toMatch(/did not finish/i);
  });

  it('marks incomplete when one source fails and still publishes the successful source', async () => {
    const mem = new MemoryPipeline();
    const svc = mem.service([
      new MemoryProvider('a', [
        samplePlant({ commonName: 'Kept', species: 'Kept species', externalId: 'k' }),
      ]),
      new MemoryProvider('b', [], new Error('Bearer abcdefghijklmnop')),
    ]);
    const run = await svc.runAndWait();
    expect(run.status).toBe('incomplete');
    expect(mem.plants.has('kept species|')).toBe(true);
    const detail = mem.runs.find((row) => row.id === run.id);
    const failed = detail?.sources.find((row) => row.sourceId === 'b');
    expect(failed?.status).toBe('failed');
    expect(failed?.errorMessage).not.toMatch(/abcdefghijklmnop/);
  });
});
