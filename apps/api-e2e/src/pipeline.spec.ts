import { test, expect } from 'vitest';
import { pipelineRunListQuerySchema } from '@open-garden/shared-types';

test('pipelineRunListQuerySchema pages with defaults', () => {
  expect(pipelineRunListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  expect(pipelineRunListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
});
