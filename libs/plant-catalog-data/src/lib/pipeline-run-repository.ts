import { and, desc, eq, sql } from 'drizzle-orm';
import type {
  PipelineMergeDecisionDto,
  PipelineRunDetailDto,
  PipelineRunSourceDto,
  PipelineRunStatus,
  PipelineRunSummaryDto,
  PipelineTriggeredBy,
} from '@open-garden/shared-types';
import type { PlantUpsertInput } from './plant-repository';
import { PlantRepository } from './plant-repository';
import { PlantSourceRepository } from './plant-source-repository';
import type { AppDatabase } from './db';
import {
  catalogPipelineMergeDecisions,
  catalogPipelineRunSources,
  catalogPipelineRuns,
} from './schema';

export type PublishPlantInput = PlantUpsertInput & {
  sourceLinks: Array<{ sourceId: string; externalId: string }>;
};

export interface PublishCatalogInput {
  runId: string;
  status: Exclude<PipelineRunStatus, 'running'>;
  errorMessage: string | null;
  plants: PublishPlantInput[];
  deprecateKeys: string[];
  plantsReactivated: number;
  recordsRejected: number;
  sources: PipelineRunSourceDto[];
  merges: PipelineMergeDecisionDto[];
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

function toSummary(row: {
  id: string;
  status: string;
  triggeredBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  plantsUpserted: number;
  plantsDeprecated: number;
  plantsReactivated: number;
  recordsRejected: number;
  errorMessage: string | null;
}): PipelineRunSummaryDto {
  return {
    id: row.id,
    status: row.status as PipelineRunSummaryDto['status'],
    triggeredBy: row.triggeredBy as PipelineTriggeredBy,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    plantsUpserted: row.plantsUpserted,
    plantsDeprecated: row.plantsDeprecated,
    plantsReactivated: row.plantsReactivated,
    recordsRejected: row.recordsRejected,
    errorMessage: row.errorMessage,
  };
}

export class PipelineRunRepository {
  constructor(private readonly db: AppDatabase) {}

  async insertRunning(triggeredBy: PipelineTriggeredBy): Promise<PipelineRunSummaryDto> {
    try {
      const [row] = await this.db
        .insert(catalogPipelineRuns)
        .values({
          triggeredBy,
          status: 'running',
        })
        .returning();
      if (!row) {
        throw new Error('Failed to create pipeline run');
      }
      return toSummary(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const conflict = new Error('A pipeline run is already running') as Error & {
          code: string;
        };
        conflict.code = 'CONFLICT';
        throw conflict;
      }
      throw err;
    }
  }

  async getById(id: string): Promise<PipelineRunSummaryDto | null> {
    const [row] = await this.db
      .select()
      .from(catalogPipelineRuns)
      .where(eq(catalogPipelineRuns.id, id))
      .limit(1);
    return row ? toSummary(row) : null;
  }

  async getDetail(id: string): Promise<PipelineRunDetailDto | null> {
    const summary = await this.getById(id);
    if (!summary) return null;
    const sourceRows = await this.db
      .select()
      .from(catalogPipelineRunSources)
      .where(eq(catalogPipelineRunSources.runId, id));
    const mergeRows = await this.db
      .select()
      .from(catalogPipelineMergeDecisions)
      .where(eq(catalogPipelineMergeDecisions.runId, id));
    return {
      ...summary,
      sources: sourceRows.map((row) => ({
        sourceId: row.sourceId,
        status: row.status as PipelineRunSourceDto['status'],
        recordsAccepted: row.recordsAccepted,
        recordsRejected: row.recordsRejected,
        errorMessage: row.errorMessage,
      })),
      merges: mergeRows.map((row) => ({
        varietyKey: row.varietyKey,
        contributingSources: row.contributingSources ?? [],
        fieldWinners: row.fieldWinners ?? {},
      })),
    };
  }

  async list(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const items = await this.db
      .select()
      .from(catalogPipelineRuns)
      .orderBy(desc(catalogPipelineRuns.startedAt))
      .limit(pageSize)
      .offset(offset);
    const [total] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(catalogPipelineRuns);
    return {
      items: items.map(toSummary),
      page,
      pageSize,
      totalCount: Number(total?.value ?? 0),
    };
  }

  async hasRunning(): Promise<boolean> {
    const [row] = await this.db
      .select({ id: catalogPipelineRuns.id })
      .from(catalogPipelineRuns)
      .where(eq(catalogPipelineRuns.status, 'running'))
      .limit(1);
    return Boolean(row);
  }

  async latestScheduledStartedAt(): Promise<Date | null> {
    const [row] = await this.db
      .select({ startedAt: catalogPipelineRuns.startedAt })
      .from(catalogPipelineRuns)
      .where(eq(catalogPipelineRuns.triggeredBy, 'schedule'))
      .orderBy(desc(catalogPipelineRuns.startedAt))
      .limit(1);
    return row?.startedAt ?? null;
  }

  async failStaleRunning(message: string): Promise<number> {
    const rows = await this.db
      .update(catalogPipelineRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: message,
      })
      .where(eq(catalogPipelineRuns.status, 'running'))
      .returning({ id: catalogPipelineRuns.id });
    return rows.length;
  }

  async markTerminal(
    id: string,
    patch: {
      status: Exclude<PipelineRunStatus, 'running'>;
      errorMessage: string | null;
      plantsUpserted?: number;
      plantsDeprecated?: number;
      plantsReactivated?: number;
      recordsRejected?: number;
    },
  ): Promise<void> {
    await this.db
      .update(catalogPipelineRuns)
      .set({
        status: patch.status,
        finishedAt: new Date(),
        errorMessage: patch.errorMessage,
        plantsUpserted: patch.plantsUpserted ?? 0,
        plantsDeprecated: patch.plantsDeprecated ?? 0,
        plantsReactivated: patch.plantsReactivated ?? 0,
        recordsRejected: patch.recordsRejected ?? 0,
      })
      .where(and(eq(catalogPipelineRuns.id, id), eq(catalogPipelineRuns.status, 'running')));
  }

  async publish(input: PublishCatalogInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const plantRepo = new PlantRepository(tx);
      const sourceRepo = new PlantSourceRepository(tx);
      for (const plant of input.plants) {
        const row = await plantRepo.upsertByVarietyKey(plant);
        if (!row) continue;
        await sourceRepo.replaceForPlant(row.id, plant.sourceLinks);
      }
      const deprecated = await plantRepo.deprecateByVarietyKeys(input.deprecateKeys);
      if (input.sources.length > 0) {
        await tx.insert(catalogPipelineRunSources).values(
          input.sources.map((source) => ({
            runId: input.runId,
            sourceId: source.sourceId,
            status: source.status,
            recordsAccepted: source.recordsAccepted,
            recordsRejected: source.recordsRejected,
            errorMessage: source.errorMessage,
          })),
        );
      }
      if (input.merges.length > 0) {
        await tx.insert(catalogPipelineMergeDecisions).values(
          input.merges.map((merge) => ({
            runId: input.runId,
            varietyKey: merge.varietyKey,
            contributingSources: merge.contributingSources,
            fieldWinners: merge.fieldWinners,
          })),
        );
      }
      await tx
        .update(catalogPipelineRuns)
        .set({
          status: input.status,
          finishedAt: new Date(),
          plantsUpserted: input.plants.length,
          plantsDeprecated: deprecated,
          plantsReactivated: input.plantsReactivated,
          recordsRejected: input.recordsRejected,
          errorMessage: input.errorMessage,
        })
        .where(
          and(eq(catalogPipelineRuns.id, input.runId), eq(catalogPipelineRuns.status, 'running')),
        );
    });
  }
}
