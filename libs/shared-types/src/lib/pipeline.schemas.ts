import { z } from 'zod';

export const pipelineRunListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PipelineRunListQueryParsed = z.infer<typeof pipelineRunListQuerySchema>;
