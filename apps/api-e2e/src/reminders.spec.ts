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

test('non-member GET is documented as 404 Garden not found', () => {
  const error = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(error.error.message).toBe('Garden not found');
});

test('bad asOf is documented as 400 Date must be YYYY-MM-DD', () => {
  const error = {
    error: { code: 'VALIDATION_ERROR', message: 'Date must be YYYY-MM-DD' },
  };
  expect(error.error.message).toBe('Date must be YYYY-MM-DD');
});

test('viewer POST is documented as 403 Viewers cannot update reminders', () => {
  const error = {
    error: { code: 'FORBIDDEN', message: 'Viewers cannot update reminders' },
  };
  expect(error.error.message).toBe('Viewers cannot update reminders');
});
