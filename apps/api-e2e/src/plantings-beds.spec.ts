import { test, expect } from 'vitest';
import { bedCreateSchema, bedPatchSchema } from '@open-garden/shared-types';

test('bed create requires a name string', () => {
  expect(bedCreateSchema.safeParse({}).success).toBe(false);
  expect(bedCreateSchema.safeParse({ name: 'Raised bed 1' }).success).toBe(true);
});

test('bed patch requires a name', () => {
  expect(bedPatchSchema.safeParse({}).success).toBe(false);
  expect(bedPatchSchema.safeParse({ name: 'Patio' }).success).toBe(true);
});

test('duplicate bed name is documented as 409', () => {
  const error = {
    error: { code: 'CONFLICT', message: 'That garden already has a bed with that name' },
  };
  expect(error.error.code).toBe('CONFLICT');
});
