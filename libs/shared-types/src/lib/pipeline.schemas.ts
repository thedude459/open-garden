import { z } from 'zod';

export const pipelineCadenceSchema = z.enum(['daily', 'disabled']);

export const pipelineSettingsPatchSchema = z
  .object({
    cadence: pipelineCadenceSchema.optional(),
    runAtHourUtc: z.coerce.number().int().min(0).max(23).optional(),
    sourceOrder: z.array(z.string().trim().min(1)).min(1).optional(),
  })
  .strict();

export const pipelineRunListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PipelineSettingsPatchParsed = z.infer<typeof pipelineSettingsPatchSchema>;
export type PipelineRunListQueryParsed = z.infer<typeof pipelineRunListQuerySchema>;
