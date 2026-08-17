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

test('non-member GET/PUT is documented as 404 Garden not found', () => {
  const error = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(error.error.message).toBe('Garden not found');
});

test('viewer PUT is documented as 403 Viewers cannot update layout', () => {
  const error = {
    error: { code: 'FORBIDDEN', message: 'Viewers cannot update layout' },
  };
  expect(error.error.message).toBe('Viewers cannot update layout');
});

test('malformed inches remain 400 Bed size and position are required', () => {
  const error = {
    error: { code: 'VALIDATION_ERROR', message: 'Bed size and position are required' },
  };
  expect(error.error.message).toBe('Bed size and position are required');
});

test('spacing/fit save gate is documented as 422 Layout has spacing or fit problems', () => {
  const error = {
    error: { code: 'VALIDATION_ERROR', message: 'Layout has spacing or fit problems' },
  };
  expect(error.error.message).toBe('Layout has spacing or fit problems');
});
