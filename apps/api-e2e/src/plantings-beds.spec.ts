import { test, expect } from 'vitest';
import { bedCreateSchema, bedPatchSchema } from '@open-garden/shared-types';

test('bed create requires a name and size', () => {
  expect(bedCreateSchema.safeParse({}).success).toBe(false);
  expect(bedCreateSchema.safeParse({ name: 'Raised bed 1' }).success).toBe(false);
  expect(
    bedCreateSchema.safeParse({ name: 'Raised bed 1', lengthInches: 96, widthInches: 48 }).success,
  ).toBe(true);
});

test('bed patch requires a name', () => {
  expect(bedPatchSchema.safeParse({}).success).toBe(false);
  expect(bedPatchSchema.safeParse({ name: 'Patio' }).success).toBe(true);
});
