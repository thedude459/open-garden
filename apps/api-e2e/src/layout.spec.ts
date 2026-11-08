import { test, expect } from 'vitest';
import { layoutPutSchema } from '@open-garden/shared-types';

const bedId = '11111111-1111-4111-8111-111111111111';
const plantingId = '22222222-2222-4222-8222-222222222222';

test('layout PUT requires integer inches, length/width ≥ 1, and 90° orientation', () => {
  expect(layoutPutSchema.safeParse({}).success).toBe(false);
  expect(
    layoutPutSchema.safeParse({
      beds: [
        {
          id: bedId,
          originXInches: 0.5,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
      ],
      placements: [],
    }).success,
  ).toBe(false);
  expect(
    layoutPutSchema.safeParse({
      beds: [
        {
          id: bedId,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 0,
          widthInches: 48,
          orientation: 0,
        },
      ],
      placements: [],
    }).success,
  ).toBe(false);
  expect(
    layoutPutSchema.safeParse({
      beds: [
        {
          id: bedId,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 45,
        },
      ],
      placements: [],
    }).success,
  ).toBe(false);
  expect(
    layoutPutSchema.safeParse({
      beds: [
        {
          id: bedId,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 90,
        },
      ],
      placements: [{ plantingId, bedId, xInches: 24, yInches: 12 }],
    }).success,
  ).toBe(true);
});
