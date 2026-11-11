export type PipelineRunStatus = 'running' | 'succeeded' | 'failed' | 'incomplete';

/** `schedule`: runs from the daily scheduler, since removed (ADR 0020); kept for their history. */
export type PipelineTriggeredBy = 'operator' | 'schedule';

export type PipelineSourceStatus = 'succeeded' | 'failed';

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
