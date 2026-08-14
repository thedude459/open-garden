import { describe, expect, it } from 'vitest';
import { validateSiteProfile } from './site-profile';

describe('site-profile', () => {
  function expectCode(fn: () => void, code: string) {
    let thrown: unknown;
    try {
      fn();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({ code });
  }

  it('accepts zone 1–13 and last frost before first frost', () => {
    expect(() =>
      validateSiteProfile({
        hardinessZone: 7,
        lastFrost: { month: 4, day: 15 },
        firstFrost: { month: 10, day: 20 },
      }),
    ).not.toThrow();
  });

  it('allows Feb 29 as an annual frost day', () => {
    expect(() =>
      validateSiteProfile({ lastFrost: { month: 2, day: 29 }, firstFrost: { month: 10, day: 1 } }),
    ).not.toThrow();
  });

  it('allows either frost date to be omitted', () => {
    expect(() => validateSiteProfile({ lastFrost: { month: 4, day: 15 } })).not.toThrow();
    expect(() => validateSiteProfile({ firstFrost: { month: 10, day: 20 } })).not.toThrow();
    expect(() => validateSiteProfile({ hardinessZone: 6 })).not.toThrow();
  });

  it('rejects zone outside 1–13', () => {
    expectCode(() => validateSiteProfile({ hardinessZone: 0 }), 'VALIDATION_ERROR');
    expectCode(() => validateSiteProfile({ hardinessZone: 14 }), 'VALIDATION_ERROR');
  });

  it('rejects same-day and reversed frost pairs', () => {
    expectCode(
      () =>
        validateSiteProfile({
          lastFrost: { month: 5, day: 1 },
          firstFrost: { month: 5, day: 1 },
        }),
      'VALIDATION_ERROR',
    );
    expectCode(
      () =>
        validateSiteProfile({
          lastFrost: { month: 10, day: 20 },
          firstFrost: { month: 4, day: 15 },
        }),
      'VALIDATION_ERROR',
    );
  });
});
