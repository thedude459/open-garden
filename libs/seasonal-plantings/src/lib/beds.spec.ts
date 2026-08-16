import { describe, expect, it } from 'vitest';
import { normalizeBedName } from './beds';

describe('normalizeBedName', () => {
  it('trims and case-folds for uniqueness', () => {
    expect(normalizeBedName('  Patio  ')).toEqual({ name: 'Patio', nameNormalized: 'patio' });
  });

  it('rejects blank and overlong names', () => {
    expect(() => normalizeBedName(' \t ')).toThrow(/Bed name is required/);
    expect(() => normalizeBedName('x'.repeat(121))).toThrow(/at most 120 characters/);
  });
});
