import { describe, expect, it } from 'vitest';
import {
  convertLength,
  feetFromTreeSpacing,
  feetToInches,
  formatLength,
  formatPlanSize,
  formatSpacing,
  inchesFromInput,
  inchesToFeetInput,
  lengthInput,
  lengthStep,
  lengthUnit,
  treeSpacingInput,
} from './display-units';

describe('display units', () => {
  it('converts whole feet to inches and back', () => {
    expect(feetToInches(8)).toBe(96);
    expect(feetToInches(4)).toBe(48);
    expect(inchesToFeetInput(96)).toBe(8);
    expect(inchesToFeetInput(48)).toBe(4);
  });

  it('rounds fractional feet to integer inches and shows half feet', () => {
    expect(feetToInches(3.5)).toBe(42);
    expect(inchesToFeetInput(54)).toBe(4.5);
    expect(inchesToFeetInput(40)).toBe(3.5);
    expect(feetToInches('3.33')).toBe(40);
  });

  it('formats bed size in feet', () => {
    expect(formatPlanSize(96, 48, 0)).toBe('8 × 4 ft · 0°');
    expect(formatPlanSize(48, 24)).toBe('4 × 2 ft');
    expect(formatPlanSize(54, 72, 90)).toBe('4.5 × 6 ft · 90°');
  });

  it('shows and reads plan lengths in metres to the centimetre', () => {
    expect(lengthInput(96, 'metric')).toBe(2.44);
    expect(lengthInput(96, 'imperial')).toBe(8);
    expect(inchesFromInput('2.44', 'metric')).toBe(96);
    expect(inchesFromInput(1, 'metric')).toBe(39);
    expect(inchesFromInput('x', 'metric')).toBe(0);
    expect(inchesFromInput('4.5', 'imperial')).toBe(54);
    expect(lengthUnit('metric')).toBe('m');
    expect(lengthStep('metric')).toBe(0.01);
    expect(lengthStep('imperial')).toBe(0.5);
    expect(formatLength(54, 'imperial')).toBe('4.5 ft');
    expect(formatLength(54, 'metric')).toBe('1.37 m');
    expect(formatPlanSize(96, 48, 90, 'metric')).toBe('2.44 × 1.22 m · 90°');
  });

  it('round-trips any whole-inch length through metres', () => {
    for (let inches = 0; inches <= 2400; inches++) {
      expect(inchesFromInput(lengthInput(inches, 'metric'), 'metric')).toBe(inches);
    }
  });

  it('re-expresses a typed length when the member switches units', () => {
    expect(convertLength(20, 'imperial', 'metric')).toBe(6.1);
    expect(convertLength(6.1, 'metric', 'imperial')).toBe(20);
    expect(convertLength(7, 'metric', 'metric')).toBe(7);
  });

  it('shows plant spacing in inches or centimetres', () => {
    expect(formatSpacing(12, 'imperial')).toBe('12 in');
    expect(formatSpacing(12, 'metric')).toBe('30 cm');
  });

  it('shows tree spacing, stored in feet, in metres to a tenth', () => {
    expect(treeSpacingInput(15, 'metric')).toBe(4.6);
    expect(treeSpacingInput(15, 'imperial')).toBe(15);
    expect(feetFromTreeSpacing('4.6', 'metric')).toBe(15);
    expect(feetFromTreeSpacing(12, 'imperial')).toBe(12);
    expect(feetFromTreeSpacing('', 'metric')).toBe(0);
  });
});
