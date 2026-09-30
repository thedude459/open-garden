import { describe, expect, it } from 'vitest';
import { staysOnPlanner } from './stays-on-planner';

describe('staysOnPlanner', () => {
  const garden = 'g1';

  it('keeps overview and bed view', () => {
    expect(staysOnPlanner(garden, '/gardens/g1/layout')).toBe(true);
    expect(staysOnPlanner(garden, '/gardens/g1/layout/beds/b1')).toBe(true);
    expect(staysOnPlanner(garden, '/gardens/g1/layout?x=1')).toBe(true);
  });

  it('leaves for other garden pages and the rest of the app', () => {
    expect(staysOnPlanner(garden, '/gardens/g1/plantings')).toBe(false);
    expect(staysOnPlanner(garden, '/gardens/g1/configure')).toBe(false);
    expect(staysOnPlanner(garden, '/gardens/other/layout')).toBe(false);
    expect(staysOnPlanner(garden, '/plants')).toBe(false);
  });
});
