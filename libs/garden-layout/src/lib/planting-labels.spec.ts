import { describe, expect, it } from 'vitest';
import { layoutPlantingLabels } from './planting-labels';

describe('layoutPlantingLabels', () => {
  it('puts each name below its mark', () => {
    const labels = layoutPlantingLabels([
      { id: 'a', name: 'Basil', x: 20, y: 20, r: 6 },
    ]);
    expect(labels[0]?.x).toBe(20);
    expect(labels[0]?.y).toBeGreaterThan(26);
  });

  it('nudge stacked labels when marks sit on top of each other', () => {
    const labels = layoutPlantingLabels([
      { id: 'a', name: 'Sweet Basil', x: 40, y: 24, r: 6 },
      { id: 'b', name: 'Cherry Tomato', x: 42, y: 24, r: 12 },
    ]);
    expect(Math.abs((labels[0]?.y ?? 0) - (labels[1]?.y ?? 0))).toBeGreaterThanOrEqual(6);
  });
});
