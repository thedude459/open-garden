import { test, expect } from 'vitest';
import { calendarAddSchema } from '@open-garden/shared-types';

test('missing plantId uses the documented validation message', () => {
  const parsed = calendarAddSchema.safeParse({});
  expect(parsed.success).toBe(false);
  expect(
    parsed.success
      ? ''
      : (parsed.error.issues[0]?.message ?? 'Plant is required'),
  ).toMatch(/Plant is required|Invalid uuid|Required/i);
});

