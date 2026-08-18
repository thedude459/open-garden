# Shared TypeScript contracts (catalog data pipeline)

Types in this document MUST be implemented in `libs/shared-types` and imported
by `apps/api` and `apps/web`. Do not duplicate. Existing plant/garden/auth/
calendar/planting/layout/reminder DTOs stay.

```ts
export type PipelineRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'incomplete';

export type PipelineTriggeredBy = 'operator' | 'schedule';

export type PipelineSourceStatus = 'succeeded' | 'failed';

export type PipelineCadence = 'daily' | 'disabled';

export interface PipelineRunSourceDto {
  sourceId: string;
  status: PipelineSourceStatus;
  recordsAccepted: number;
  recordsRejected: number;
  errorMessage: string | null;
}

export interface PipelineRunSummaryDto {
  id: string;
  status: PipelineRunStatus;
  triggeredBy: PipelineTriggeredBy;
  startedAt: string;
  finishedAt: string | null;
  plantsUpserted: number;
  plantsDeprecated: number;
  plantsReactivated: number;
  recordsRejected: number;
  errorMessage: string | null;
}

export interface PipelineMergeDecisionDto {
  varietyKey: string;
  contributingSources: string[];
  fieldWinners: Record<string, string>;
}

export interface PipelineRunDetailDto extends PipelineRunSummaryDto {
  sources: PipelineRunSourceDto[];
  merges: PipelineMergeDecisionDto[];
}

export interface PipelineRunListDto {
  items: PipelineRunSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PipelineSettingsDto {
  cadence: PipelineCadence;
  runAtHourUtc: number;
  sourceOrder: string[];
  registeredSources: string[];
}

export interface PipelineSettingsPatchDto {
  cadence?: PipelineCadence;
  runAtHourUtc?: number;
  sourceOrder?: string[];
}
```

Zod schemas live next to these types (`pipeline.schemas.ts`) and are used by
the API and by `apps/api-e2e` contract smokes.
