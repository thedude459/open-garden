import { describe, expect, it } from 'vitest';
import { viewportCenterPlan } from './viewport-center';

describe('viewportCenterPlan', () => {
  it('maps the viewport center into plan inches', () => {
    expect(viewportCenterPlan(0, 0, 1, 800, 600, 2)).toEqual({ x: 200, y: 150 });
  });
});
