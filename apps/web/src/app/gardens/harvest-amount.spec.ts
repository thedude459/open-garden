import { describe, expect, it } from 'vitest';
import { harvestAmount } from './harvest-amount';

describe('harvestAmount', () => {
  it('reads a weight, a count, both, or neither', () => {
    expect(harvestAmount({ grams: 1089, count: null }, 'imperial')).toBe('2.4 lb');
    expect(harvestAmount({ grams: null, count: 6 }, 'metric')).toBe('6 picked');
    expect(harvestAmount({ grams: 1200, count: 6 }, 'metric')).toBe('1.2 kg and 6 picked');
    expect(harvestAmount({ grams: 0, count: null }, 'metric')).toBe('—');
  });
});
