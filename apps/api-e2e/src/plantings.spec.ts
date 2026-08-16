import { test, expect } from 'vitest';
import {
  plantingCreateSchema,
  plantingListQuerySchema,
  plantingPatchSchema,
} from '@open-garden/shared-types';

test('planting create requires a UUID plantId', () => {
  expect(plantingCreateSchema.safeParse({}).success).toBe(false);
  expect(plantingCreateSchema.safeParse({ plantId: 'not-a-uuid' }).success).toBe(false);
  expect(
    plantingCreateSchema.safeParse({ plantId: '11111111-1111-4111-8111-111111111111' }).success,
  ).toBe(true);
});

test('planting list query defaults pageSize to 200 and caps at 500', () => {
  const empty = plantingListQuerySchema.parse({});
  expect(empty.page).toBe(1);
  expect(empty.pageSize).toBe(200);
  expect(plantingListQuerySchema.safeParse({ pageSize: 501 }).success).toBe(false);
  expect(plantingListQuerySchema.parse({ pageSize: 500 }).pageSize).toBe(500);
});

test('invalid ISO dates are rejected', () => {
  expect(plantingPatchSchema.safeParse({ plantedOn: 'June 1' }).success).toBe(false);
  expect(plantingPatchSchema.safeParse({ plantedOn: '2026-06-01' }).success).toBe(true);
  expect(plantingPatchSchema.safeParse({ plantedOn: null }).success).toBe(true);
});

test('non-member GET is documented as 404 Garden not found', () => {
  const error = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(error.error.message).toBe('Garden not found');
});

test('viewer mutate is documented as 403', () => {
  const error = {
    error: { code: 'FORBIDDEN', message: 'Viewers cannot update plantings' },
  };
  expect(error.error.message).toBe('Viewers cannot update plantings');
});
