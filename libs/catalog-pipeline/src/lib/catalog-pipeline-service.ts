import type { PlantDataProvider } from '@open-garden/plant-provider';
import type {
  PipelineCadence,
  PipelineMergeDecisionDto,
  PipelineRunSourceDto,
  PipelineRunStatus,
  PipelineRunSummaryDto,
  PipelineTriggeredBy,
} from '@open-garden/shared-types';
import type { PlantUpsertInput } from '@open-garden/plant-catalog-data';
import { PIPELINE_ERRORS } from './domain-error';
import { fetchAllFromProvider } from './fetch-all';
import { mergeCatalogRecords, varietiesToDeprecate, type MergedPlant } from './merge';
import { shouldStartScheduled } from './schedule';

export interface PipelineSettingsPort {
  get(): Promise<{ cadence: PipelineCadence; runAtHourUtc: number; sourceOrder: string[] }>;
}

export interface PipelineRunPort {
  insertRunning(triggeredBy: PipelineTriggeredBy): Promise<PipelineRunSummaryDto>;
  getById(id: string): Promise<PipelineRunSummaryDto | null>;
  failStaleRunning(message: string): Promise<number>;
  hasRunning(): Promise<boolean>;
  latestScheduledStartedAt(): Promise<Date | null>;
  markTerminal(
    id: string,
    patch: {
      status: Exclude<PipelineRunStatus, 'running'>;
      errorMessage: string | null;
      plantsUpserted?: number;
      plantsDeprecated?: number;
      plantsReactivated?: number;
      recordsRejected?: number;
    },
  ): Promise<void>;
  publish(input: {
    runId: string;
    status: Exclude<PipelineRunStatus, 'running'>;
    errorMessage: string | null;
    plants: Array<PlantUpsertInput & { sourceLinks: Array<{ sourceId: string; externalId: string }> }>;
    deprecateKeys: string[];
    plantsReactivated: number;
    recordsRejected: number;
    sources: PipelineRunSourceDto[];
    merges: PipelineMergeDecisionDto[];
  }): Promise<void>;
}

export interface PipelineCatalogPort {
  listSnapshots(): Promise<Array<{ id: string; varietyKey: string; status: string }>>;
  listSourceLinks(): Promise<Array<{ plantId: string; sourceId: string; externalId: string }>>;
}

const STALE_MESSAGE = 'Pipeline run did not finish (process restart)';

export function sanitizeErrorMessage(err: unknown): string {
  let msg = err instanceof Error ? err.message : 'Source failed';
  msg = msg.replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[redacted]');
  msg = msg.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  msg = msg.replace(/PERENUAL_API_KEY\s*=\s*\S+/gi, 'PERENUAL_API_KEY=[redacted]');
  if (msg.length > 500) msg = msg.slice(0, 500);
  return msg;
}

export class CatalogPipelineService {
  constructor(
    private readonly runs: PipelineRunPort,
    private readonly settings: PipelineSettingsPort,
    private readonly catalog: PipelineCatalogPort,
    private readonly sources: PlantDataProvider[],
  ) {}

  registeredSourceIds(): string[] {
    return this.sources.map((source) => source.id);
  }

  async failStaleRunning(): Promise<number> {
    return this.runs.failStaleRunning(STALE_MESSAGE);
  }

  async start(triggeredBy: PipelineTriggeredBy = 'operator'): Promise<PipelineRunSummaryDto> {
    try {
      return await this.runs.insertRunning(triggeredBy);
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'CONFLICT') {
        throw PIPELINE_ERRORS.alreadyRunning();
      }
      throw err;
    }
  }

  async runAndWait(triggeredBy: PipelineTriggeredBy = 'operator'): Promise<PipelineRunSummaryDto> {
    const run = await this.start(triggeredBy);
    return this.executeRun(run.id);
  }

  async tryStartScheduled(now = new Date()): Promise<PipelineRunSummaryDto | null> {
    const settings = await this.settings.get();
    const hasRunning = await this.runs.hasRunning();
    const lastScheduled = await this.runs.latestScheduledStartedAt();
    if (!shouldStartScheduled(settings, now, hasRunning, lastScheduled)) {
      return null;
    }
    try {
      return await this.start('schedule');
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'CONFLICT') {
        return null;
      }
      throw err;
    }
  }

  async executeRun(runId: string): Promise<PipelineRunSummaryDto> {
    const existing = await this.runs.getById(runId);
    if (!existing) throw PIPELINE_ERRORS.runNotFound();

    try {
      const settings = await this.settings.get();
      const registry = new Map(this.sources.map((source) => [source.id, source]));
      const unknown = settings.sourceOrder.filter((id) => !registry.has(id));
      const enabled = settings.sourceOrder.filter((id) => registry.has(id));
      const notes: string[] = [];
      if (unknown.length > 0) {
        notes.push(`Ignored unknown sources: ${unknown.join(', ')}`);
      }

      if (enabled.length === 0) {
        await this.runs.markTerminal(runId, {
          status: 'failed',
          errorMessage: notes.concat(['No enabled sources in sourceOrder']).join('. '),
        });
        return (await this.runs.getById(runId)) ?? existing;
      }

      const sourceRows: PipelineRunSourceDto[] = [];
      const batches: Array<{ sourceId: string; plants: import('@open-garden/plant-provider').ProviderPlant[] }> =
        [];

      for (const sourceId of enabled) {
        const provider = registry.get(sourceId);
        if (!provider) continue;
        try {
          const plants = await fetchAllFromProvider(provider);
          sourceRows.push({
            sourceId,
            status: 'succeeded',
            recordsAccepted: plants.length,
            recordsRejected: 0,
            errorMessage: null,
          });
          batches.push({ sourceId, plants });
        } catch (err) {
          sourceRows.push({
            sourceId,
            status: 'failed',
            recordsAccepted: 0,
            recordsRejected: 0,
            errorMessage: sanitizeErrorMessage(err),
          });
        }
      }

      const succeeded = sourceRows.filter((row) => row.status === 'succeeded');
      const failed = sourceRows.filter((row) => row.status === 'failed');
      if (succeeded.length === 0) {
        await this.runs.markTerminal(runId, {
          status: 'failed',
          errorMessage: notes.concat(failed.map((row) => row.errorMessage).filter(Boolean) as string[]).join('. ') ||
            'All sources failed',
        });
        return (await this.runs.getById(runId)) ?? existing;
      }

      const merge = mergeCatalogRecords(batches, enabled);
      const snapshots = await this.catalog.listSnapshots();
      const links = await this.catalog.listSourceLinks();
      const linksByPlant = new Map<string, string[]>();
      for (const link of links) {
        const ids = linksByPlant.get(link.plantId) ?? [];
        ids.push(link.sourceId);
        linksByPlant.set(link.plantId, ids);
      }
      const previous = snapshots.map((snap) => ({
        varietyKey: snap.varietyKey,
        sourceIds: linksByPlant.get(snap.id) ?? [],
        status: snap.status,
      }));
      const mergedKeys = new Set(merge.merged.map((plant) => plant.varietyKey));
      const confirming = new Set(
        sourceRows
          .filter((row) => row.status === 'succeeded' && row.recordsAccepted > 0)
          .map((row) => row.sourceId),
      );
      const deprecateKeys = varietiesToDeprecate(previous, mergedKeys, confirming);
      const reactivated = previous.filter(
        (plant) => plant.status === 'deprecated' && mergedKeys.has(plant.varietyKey),
      ).length;

      for (const row of sourceRows) {
        if (row.status !== 'succeeded') continue;
        const batch = batches.find((b) => b.sourceId === row.sourceId);
        if (!batch) continue;
        const invalid = batch.plants.filter(
          (p) => !p.commonName?.trim() || !p.species?.trim(),
        ).length;
        row.recordsRejected = invalid;
        row.recordsAccepted = batch.plants.length - invalid;
      }

      const overall: Exclude<PipelineRunStatus, 'running'> =
        failed.length === 0 ? 'succeeded' : 'incomplete';
      const errorMessage =
        notes.length > 0 || failed.length > 0
          ? [...notes, ...failed.map((row) => `${row.sourceId}: ${row.errorMessage ?? 'failed'}`)].join('. ')
          : null;

      await this.runs.publish({
        runId,
        status: overall,
        errorMessage,
        plants: merge.merged.map(toUpsert),
        deprecateKeys,
        plantsReactivated: reactivated,
        recordsRejected: merge.rejected,
        sources: sourceRows,
        merges: merge.merged.map((plant) => ({
          varietyKey: plant.varietyKey,
          contributingSources: plant.contributingSources,
          fieldWinners: plant.fieldWinners,
        })),
      });

      return (await this.runs.getById(runId)) ?? existing;
    } catch (err) {
      await this.runs.markTerminal(runId, {
        status: 'failed',
        errorMessage: sanitizeErrorMessage(err),
      });
      throw err;
    }
  }
}

function toUpsert(
  plant: MergedPlant,
): PlantUpsertInput & { sourceLinks: Array<{ sourceId: string; externalId: string }> } {
  return {
    varietyKey: plant.varietyKey,
    commonName: plant.commonName,
    species: plant.species,
    cultivar: plant.cultivar,
    plantType: plant.plantType,
    zoneMin: plant.zoneMin,
    zoneMax: plant.zoneMax,
    sunRequirements: plant.sunRequirements,
    waterNeeds: plant.waterNeeds,
    daysToMaturity: plant.daysToMaturity,
    spacingInches: plant.spacingInches,
    waterIntervalDays: plant.waterIntervalDays,
    fertilizeIntervalDays: plant.fertilizeIntervalDays,
    provider: plant.provider,
    providerExternalId: plant.providerExternalId,
    growingGuidance: plant.growingGuidance,
    sourceLinks: plant.sourceLinks,
  };
}
