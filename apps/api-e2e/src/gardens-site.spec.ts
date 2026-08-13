import { test, expect } from 'vitest';
import { gardenPatchSchema } from '@open-garden/shared-types';

test('site patch rejects zone outside 1–13 at the contract boundary', () => {
  expect(gardenPatchSchema.safeParse({ hardinessZone: 0 }).success).toBe(false);
  expect(gardenPatchSchema.safeParse({ hardinessZone: 7 }).success).toBe(true);
});

test('frost month-day shape', () => {
  expect(
    gardenPatchSchema.safeParse({ lastFrost: { month: 4, day: 15 } }).success,
  ).toBe(true);
  expect(gardenPatchSchema.safeParse({ lastFrost: { month: 13, day: 1 } }).success).toBe(
    false,
  );
});
