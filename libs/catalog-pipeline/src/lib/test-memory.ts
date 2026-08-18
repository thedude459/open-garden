import type { PlantDataProvider, ProviderPlant } from '@open-garden/plant-provider';
import type {
  PipelineCadence,
  PipelineMergeDecisionDto,
  PipelineRunSourceDto,
  PipelineRunSummaryDto,
  PipelineTriggeredBy,
} from '@open-garden/shared-types';
import type { PlantUpsertInput } from '@open-garden/plant-catalog-data';
import {
  CatalogPipelineService,
  type PipelineCatalogPort,
  type PipelineRunPort,
  type PipelineSettingsPort,
} from './catalog-pipeline-service';

export class MemoryProvider implements PlantDataProvider {
  constructor(
    readonly id: string,
    public plants: ProviderPlant[],
    public error?: Error,
  ) {}

  async searchByName(): Promise<ProviderPlant[]> {
    return [];
  }

  async listPage(options?: { cursor?: string; limit?: number }) {
    if (this.error) throw this.error;
    const limit = options?.limit ?? 50;
    const start = options?.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = this.plants.slice(start, start + limit);
    const next = start + limit;
    return {
      items,
      nextCursor: next < this.plants.length ? String(next) : undefined,
    };
  }
}

type MemoryPlant = PlantUpsertInput & {
  id: string;
  status: string;
  sourceLinks: Array<{ sourceId: string; externalId: string }>;
};

type MemoryRun = PipelineRunSummaryDto & {
  sources: PipelineRunSourceDto[];
  merges: PipelineMergeDecisionDto[];
};

export class MemoryPipeline {
  settings: { cadence: PipelineCadence; runAtHourUtc: number; sourceOrder: string[] } = {
    cadence: 'daily',
    runAtHourUtc: 6,
    sourceOrder: ['a'],
  };
  runs: MemoryRun[] = [];
  plants = new Map<string, MemoryPlant>();
  private seq = 0;

  readonly settingsPort: PipelineSettingsPort = {
    get: async () => ({ ...this.settings }),
  };

  readonly runsPort: PipelineRunPort = {
    insertRunning: async (triggeredBy: PipelineTriggeredBy) => {
      if (this.runs.some((run) => run.status === 'running')) {
        const err = new Error('A pipeline run is already running') as Error & { code: string };
        err.code = 'CONFLICT';
        throw err;
      }
      const run: MemoryRun = {
        id: `run-${++this.seq}`,
        status: 'running',
        triggeredBy,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        plantsUpserted: 0,
        plantsDeprecated: 0,
        plantsReactivated: 0,
        recordsRejected: 0,
        errorMessage: null,
        sources: [],
        merges: [],
      };
      this.runs.push(run);
      return { ...run };
    },
    getById: async (id: string) => {
      const run = this.runs.find((row) => row.id === id);
      return run ? { ...run } : null;
    },
    failStaleRunning: async (message: string) => {
      let count = 0;
      for (const run of this.runs) {
        if (run.status !== 'running') continue;
        run.status = 'failed';
        run.finishedAt = new Date().toISOString();
        run.errorMessage = message;
        count += 1;
      }
      return count;
    },
    hasRunning: async () => this.runs.some((run) => run.status === 'running'),
    latestScheduledStartedAt: async () => {
      const scheduled = this.runs.filter((run) => run.triggeredBy === 'schedule');
      const last = scheduled[scheduled.length - 1];
      return last ? new Date(last.startedAt) : null;
    },
    markTerminal: async (id, patch) => {
      const run = this.runs.find((row) => row.id === id);
      if (!run || run.status !== 'running') return;
      run.status = patch.status;
      run.finishedAt = new Date().toISOString();
      run.errorMessage = patch.errorMessage;
      run.plantsUpserted = patch.plantsUpserted ?? 0;
      run.plantsDeprecated = patch.plantsDeprecated ?? 0;
      run.plantsReactivated = patch.plantsReactivated ?? 0;
      run.recordsRejected = patch.recordsRejected ?? 0;
    },
    publish: async (input) => {
      const run = this.runs.find((row) => row.id === input.runId);
      if (!run) return;
      for (const plant of input.plants) {
        const existing = this.plants.get(plant.varietyKey);
        this.plants.set(plant.varietyKey, {
          ...plant,
          id: existing?.id ?? `plant-${plant.varietyKey}`,
          status: 'active',
          sourceLinks: plant.sourceLinks,
        });
      }
      let deprecated = 0;
      for (const key of input.deprecateKeys) {
        const plant = this.plants.get(key);
        if (!plant) continue;
        plant.status = 'deprecated';
        deprecated += 1;
      }
      run.status = input.status;
      run.finishedAt = new Date().toISOString();
      run.errorMessage = input.errorMessage;
      run.plantsUpserted = input.plants.length;
      run.plantsDeprecated = deprecated;
      run.plantsReactivated = input.plantsReactivated;
      run.recordsRejected = input.recordsRejected;
      run.sources = input.sources;
      run.merges = input.merges;
    },
  };

  readonly catalogPort: PipelineCatalogPort = {
    listSnapshots: async () =>
      [...this.plants.values()].map((plant) => ({
        id: plant.id,
        varietyKey: plant.varietyKey,
        status: plant.status,
      })),
    listSourceLinks: async () =>
      [...this.plants.values()].flatMap((plant) =>
        plant.sourceLinks.map((link) => ({
          plantId: plant.id,
          sourceId: link.sourceId,
          externalId: link.externalId,
        })),
      ),
  };

  service(sources: PlantDataProvider[]) {
    return new CatalogPipelineService(this.runsPort, this.settingsPort, this.catalogPort, sources);
  }
}

export function samplePlant(overrides: Partial<ProviderPlant> = {}): ProviderPlant {
  return {
    externalId: 'x1',
    commonName: 'Sample',
    species: 'Sample species',
    cultivar: null,
    plantType: 'herb',
    zoneMin: 4,
    zoneMax: 9,
    sunRequirements: 'Full sun',
    waterNeeds: 'Moderate',
    daysToMaturity: 40,
    spacingInches: 12,
    ...overrides,
  };
}
