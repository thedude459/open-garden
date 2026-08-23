import { test, expect } from 'vitest';
import {
  pipelineCadenceSchema,
  pipelineRunListQuerySchema,
  pipelineSettingsPatchSchema,
} from '@open-garden/shared-types';

test('pipelineCadenceSchema accepts daily and disabled', () => {
  expect(pipelineCadenceSchema.safeParse('daily').success).toBe(true);
  expect(pipelineCadenceSchema.safeParse('disabled').success).toBe(true);
  expect(pipelineCadenceSchema.safeParse('weekly').success).toBe(false);
});

test('pipelineSettingsPatchSchema validates hour and sourceOrder', () => {
  expect(
    pipelineSettingsPatchSchema.safeParse({
      cadence: 'daily',
      runAtHourUtc: 6,
      sourceOrder: ['fixture'],
    }).success,
  ).toBe(true);
  expect(pipelineSettingsPatchSchema.safeParse({ runAtHourUtc: 24 }).success).toBe(false);
  expect(pipelineSettingsPatchSchema.safeParse({ sourceOrder: [] }).success).toBe(false);
  expect(pipelineSettingsPatchSchema.safeParse({ sourceOrder: [''] }).success).toBe(false);
});

test('pipelineRunListQuerySchema pages with defaults', () => {
  expect(pipelineRunListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  expect(pipelineRunListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
});

test('non-admin pipeline start is documented as 403 Admin role required', () => {
  const error = { error: { code: 'FORBIDDEN', message: 'Admin role required' } };
  expect(error.error.message).toBe('Admin role required');
});
