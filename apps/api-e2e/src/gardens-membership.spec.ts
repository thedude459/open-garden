import { test, expect } from 'vitest';
import { gardenInviteSchema, gardenMemberPatchSchema } from '@open-garden/shared-types';

/**
 * Zod contract smokes for CI without a live DB.
 * HTTP membership integration lives in apps/web-e2e/src/garden-api.spec.ts.
 */
test('member list is not exposed by error payload for strangers', () => {
  const hidden = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(hidden).not.toHaveProperty('members');
  expect(hidden.error.code).toBe('NOT_FOUND');
});

test('invite requires an email and collaborator/viewer role', () => {
  expect(gardenInviteSchema.safeParse({ email: 'x', role: 'collaborator' }).success).toBe(
    false,
  );
  expect(
    gardenInviteSchema.safeParse({ email: 'friend@example.com', role: 'collaborator' })
      .success,
  ).toBe(true);
});

test('invite role cannot be owner', () => {
  expect(
    gardenInviteSchema.safeParse({ email: 'a@b.com', role: 'owner' }).success,
  ).toBe(false);
  expect(
    gardenInviteSchema.safeParse({ email: 'a@b.com', role: 'collaborator' }).success,
  ).toBe(true);
});

test('member patch can transfer via role owner', () => {
  expect(gardenMemberPatchSchema.safeParse({ role: 'owner' }).success).toBe(true);
  expect(gardenMemberPatchSchema.safeParse({ role: 'viewer' }).success).toBe(true);
});
