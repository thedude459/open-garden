import { describe, expect, it } from 'vitest';
import { assertBootEnv } from './boot-env';

describe('assertBootEnv', () => {
  it('throws naming SESSION_SECRET when missing', () => {
    expect(() => assertBootEnv({ DATABASE_URL: 'postgresql://x' })).toThrow(/SESSION_SECRET/);
  });

  it('throws naming SESSION_SECRET when empty', () => {
    expect(() =>
      assertBootEnv({ SESSION_SECRET: '  ', DATABASE_URL: 'postgresql://x' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('throws naming DATABASE_URL when missing', () => {
    expect(() => assertBootEnv({ SESSION_SECRET: 's' })).toThrow(/DATABASE_URL/);
  });

  it('accepts non-empty SESSION_SECRET and DATABASE_URL', () => {
    expect(() =>
      assertBootEnv({ SESSION_SECRET: 's', DATABASE_URL: 'postgresql://x' }),
    ).not.toThrow();
  });
});
