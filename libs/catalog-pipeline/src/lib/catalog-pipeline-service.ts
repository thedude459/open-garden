import { createHash } from 'node:crypto';
import type { PlantDataProvider } from '@open-garden/plant-provider';
import type {
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

export interface PipelineRunPort {
  insertRunning(triggeredBy: PipelineTriggeredBy): Promise<PipelineRunSummaryDto>;
  getById(id: string): Promise<PipelineRunSummaryDto | null>;
  failStaleRunning(message: string): Promise<number>;
  /** Hash of the catalog the last successful run published. */
  latestPublishedHash(): Promise<string | null>;
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
    plants: Array<
      PlantUpsertInput & { sourceLinks: Array<{ sourceId: string; externalId: string }> }
    >;
    deprecateKeys: string[];
    plantsReactivated: number;
    recordsRejected: number;
    sources: PipelineRunSourceDto[];
    merges: PipelineMergeDecisionDto[];
    catalogHash: string | null;
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
  if (msg.length > 500) msg = msg.slice(0, 500);
  return msg;
}

export class CatalogPipelineService {
  /** `sources` in merge order: a later source's values win. The app registers one, the dataset. */
  constructor(
    private readonly runs: PipelineRunPort,
    private readonly catalog: PipelineCatalogPort,
    private readonly sources: PlantDataProvider[],
  ) {}

  async failStaleRunning(): Promise<number> {
    return this.runs.failStaleRunning(STALE_MESSAGE);
  }

  async start(triggeredBy: PipelineTriggeredBy = 'operator'): Promise<PipelineRunSummaryDto> {
    try {
      return await this.runs.insertRunning(triggeredBy);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'CONFLICT'
      ) {
        throw PIPELINE_ERRORS.alreadyRunning();
      }
      throw err;
    }
  }

  async runAndWait(triggeredBy: PipelineTriggeredBy = 'operator'): Promise<PipelineRunSummaryDto> {
    const run = await this.start(triggeredBy);
    return this.executeRun(run.id);
  }

  async executeRun(runId: string): Promise<PipelineRunSummaryDto> {
    const existing = await this.runs.getById(runId);
    if (!existing) throw PIPELINE_ERRORS.runNotFound();

    try {
      if (this.sources.length === 0) {
        await this.runs.markTerminal(runId, { status: 'failed', errorMessage: 'No plant sources' });
        return (await this.runs.getById(runId)) ?? existing;
      }

      const sourceRows: PipelineRunSourceDto[] = [];
      const batches: Array<{
        sourceId: string;
        plants: import('@open-garden/plant-provider').ProviderPlant[];
        skipped: number;
      }> = [];

      for (const provider of this.sources) {
        const sourceId = provider.id;
        try {
          const { plants, skipped } = await fetchAllFromProvider(provider);
          sourceRows.push({
            sourceId,
            status: 'succeeded',
            recordsAccepted: plants.length,
            recordsRejected: 0,
            errorMessage: null,
          });
          batches.push({ sourceId, plants, skipped });
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
          errorMessage:
            failed
              .map((row) => row.errorMessage)
              .filter(Boolean)
              .join('. ') || 'All sources failed',
        });
        return (await this.runs.getById(runId)) ?? existing;
      }

      const merge = mergeCatalogRecords(
        batches,
        this.sources.map((source) => source.id),
      );
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
        // Unreadable records the source left out count as rejected too.
        row.recordsRejected = invalid + batch.skipped;
        row.recordsAccepted = batch.plants.length - invalid;
      }

      const overall: Exclude<PipelineRunStatus, 'running'> =
        failed.length === 0 ? 'succeeded' : 'incomplete';
      const errorMessage =
        failed.length > 0
          ? failed.map((row) => `${row.sourceId}: ${row.errorMessage ?? 'failed'}`).join('. ')
          : null;

      const plants = merge.merged.map(toUpsert);
      const recordsRejected = merge.rejected + batches.reduce((n, b) => n + b.skipped, 0);
      const catalogHash = overall === 'succeeded' ? hashCatalog(plants) : null;
      // The catalog matches the last successful run and nothing needs
      // deprecating or reactivating: record the run, write no plants.
      const unchanged =
        catalogHash !== null &&
        deprecateKeys.length === 0 &&
        reactivated === 0 &&
        catalogHash === (await this.runs.latestPublishedHash());

      await this.runs.publish({
        runId,
        status: overall,
        errorMessage: unchanged
          ? [errorMessage, 'Catalog unchanged since the last run; nothing written']
              .filter(Boolean)
              .join('. ')
          : errorMessage,
        plants: unchanged ? [] : plants,
        deprecateKeys,
        plantsReactivated: reactivated,
        recordsRejected,
        sources: sourceRows,
        merges: unchanged
          ? []
          : merge.merged.map((plant) => ({
              varietyKey: plant.varietyKey,
              contributingSources: plant.contributingSources,
              fieldWinners: plant.fieldWinners,
            })),
        catalogHash,
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

/** A stable SHA-256 of the plants a run would publish, independent of source order. */
export function hashCatalog(plants: Array<{ varietyKey: string }>): string {
  const sorted = [...plants].sort((a, b) => a.varietyKey.localeCompare(b.varietyKey));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
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
    rootstockSpacingInches: plant.rootstockSpacingInches,
    sowingTemperature: plant.sowingTemperature,
    family: plant.family,
    sourceLinks: plant.sourceLinks,
  };
}
