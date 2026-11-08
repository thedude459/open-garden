import { test, expect } from 'vitest';
import { asOfQuerySchema, reminderMutationSchema } from '@open-garden/shared-types';

test('asOfQuerySchema requires YYYY-MM-DD', () => {
  expect(asOfQuerySchema.safeParse({ asOf: '2026-08-17' }).success).toBe(true);
  expect(asOfQuerySchema.safeParse({ asOf: '08-17-2026' }).success).toBe(false);
});

test('reminderMutationSchema validates mutation body', () => {
  expect(
    reminderMutationSchema.safeParse({
      plantingId: '11111111-1111-4111-8111-111111111111',
      kind: 'harvest',
      dueOn: '2026-08-17',
    }).success,
  ).toBe(true);
  expect(
    reminderMutationSchema.safeParse({
      plantingId: '11111111-1111-4111-8111-111111111111',
      kind: 'invalid',
      dueOn: '2026-08-17',
    }).success,
  ).toBe(false);
});
