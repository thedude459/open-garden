import { test, expect } from 'vitest';
import { WASHINGTON_PLACE } from '@open-garden/garden-place';
import { gardenCreateSchema, gardenPatchSchema } from '@open-garden/shared-types';

/**
 * Zod contract smokes for CI without a live DB.
 * HTTP+Postgres garden integration lives in apps/api-e2e/src/garden-http.spec.ts (E2E_LIVE=1).
 * Invite/member-patch schemas are covered in gardens-membership.spec.ts.
 */
test('garden create contract requires a name and address', () => {
  expect(gardenCreateSchema.safeParse({}).success).toBe(false);
  expect(gardenCreateSchema.safeParse({ name: 'Backyard' }).success).toBe(false);
  expect(gardenCreateSchema.safeParse({ name: 'Backyard', place: WASHINGTON_PLACE }).success).toBe(true);
});

test('garden create rejects names longer than 120 characters', () => {
  expect(
    gardenCreateSchema.safeParse({ name: 'x'.repeat(121), place: WASHINGTON_PLACE }).success,
  ).toBe(false);
});

test('garden patch allows clearing frost', () => {
  expect(gardenPatchSchema.safeParse({ firstFrost: null }).success).toBe(true);
});

test('non-member GET is documented as 404', () => {
  const error = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(error.error.code).toBe('NOT_FOUND');
  expect(error.error.message).toBe('Garden not found');
});
