import { describe, expect, it } from 'vitest';
import { CatalogPipelineService } from './catalog-pipeline-service';
import { shouldStartScheduled } from './schedule';
import { MemoryPipeline } from './test-memory';

describe('tryStartScheduled', () => {
  it('starts when cadence is daily and the UTC hour matches', async () => {
    const mem = new MemoryPipeline();
    mem.settings = { cadence: 'daily', runAtHourUtc: 6, sourceOrder: ['a'] };
    const svc = new CatalogPipelineService(mem.runsPort, mem.settingsPort, mem.catalogPort, []);
    const now = new Date(Date.UTC(2026, 7, 18, 6, 15));
    const run = await svc.tryStartScheduled(now);
    expect(run?.status).toBe('running');
    expect(run?.triggeredBy).toBe('schedule');
  });

  it('is a no-op when a run is already running', async () => {
    const mem = new MemoryPipeline();
    mem.settings = { cadence: 'daily', runAtHourUtc: 6, sourceOrder: ['a'] };
    const svc = new CatalogPipelineService(mem.runsPort, mem.settingsPort, mem.catalogPort, []);
    await svc.start('operator');
    const now = new Date(Date.UTC(2026, 7, 18, 6, 15));
    const run = await svc.tryStartScheduled(now);
    expect(run).toBeNull();
  });

  it('does not start when cadence is disabled', async () => {
    const mem = new MemoryPipeline();
    mem.settings = { cadence: 'disabled', runAtHourUtc: 6, sourceOrder: ['a'] };
    const svc = new CatalogPipelineService(mem.runsPort, mem.settingsPort, mem.catalogPort, []);
    const now = new Date(Date.UTC(2026, 7, 18, 6, 15));
    expect(await svc.tryStartScheduled(now)).toBeNull();
  });

  it('shouldStartScheduled is false outside the hour', () => {
    expect(
      shouldStartScheduled(
        { cadence: 'daily', runAtHourUtc: 6 },
        new Date(Date.UTC(2026, 7, 18, 7, 0)),
        false,
        null,
      ),
    ).toBe(false);
  });
});
