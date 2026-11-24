import { describe, expect, it } from 'vitest';
import { idOf, isUuid } from './ids';

describe('route ids', () => {
  it('accepts a UUID in either case', () => {
    expect(isUuid('5c7d758d-75f2-489c-8e5b-780333c97c8f')).toBe(true);
    expect(isUuid('5C7D758D-75F2-489C-8E5B-780333C97C8F')).toBe(true);
  });

  it('rejects anything Postgres would refuse', () => {
    for (const bad of [
      '',
      '42',
      'not-a-uuid',
      '5c7d758d-75f2-489c-8e5b-780333c97c8',
      "' or 1=1 --",
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });

  it('answers a malformed id as not found', async () => {
    await expect(idOf('Bed').transform('xyz', { type: 'param' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Bed not found',
    });
    await expect(
      idOf('Bed').transform('5c7d758d-75f2-489c-8e5b-780333c97c8f', { type: 'param' }),
    ).resolves.toBe('5c7d758d-75f2-489c-8e5b-780333c97c8f');
  });
});
