import { describe, expect, it } from 'vitest';
import { layoutPlantingLabels, shortenPlantingMarkName } from './planting-labels';

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

describe('shortenPlantingMarkName', () => {
  it('leaves a short name unchanged when it fits', () => {
    expect(shortenPlantingMarkName('Basil', 20)).toBe('Basil');
  });

  it('takes a prefix that fits 2 * r using CHAR_W', () => {
    const shortened = shortenPlantingMarkName('Sweet Basil', 6);
    expect(shortened.length).toBeLessThan('Sweet Basil'.length);
    expect('Sweet Basil'.startsWith(shortened)).toBe(true);
    expect(shortened.length).toBe(Math.floor((2 * 6) / 3.1));
  });

  it('returns one character when the mark is tiny', () => {
    expect(shortenPlantingMarkName('Basil', 0)).toBe('B');
    expect(shortenPlantingMarkName('', 0)).toBe('');
  });
});

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
