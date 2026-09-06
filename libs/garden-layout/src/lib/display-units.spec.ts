import { describe, expect, it } from 'vitest';
import { feetToInches, formatPlanSize, inchesToFeetInput } from './display-units';

describe('display units', () => {
  it('converts whole feet to inches and back', () => {
    expect(feetToInches(8)).toBe(96);
    expect(feetToInches(4)).toBe(48);
    expect(inchesToFeetInput(96)).toBe(8);
    expect(inchesToFeetInput(48)).toBe(4);
  });

  it('rounds fractional feet to integer inches', () => {
    expect(feetToInches(3.5)).toBe(42);
    expect(inchesToFeetInput(40)).toBe(3.33);
    expect(feetToInches('3.33')).toBe(40);
  });

  it('formats bed size in feet', () => {
    expect(formatPlanSize(96, 48, 0)).toBe('8 × 4 ft · 0°');
    expect(formatPlanSize(48, 24)).toBe('4 × 2 ft');
    expect(formatPlanSize(40, 20, 90)).toBe('3.33 × 1.67 ft · 90°');
  });
});
