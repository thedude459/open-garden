import type { Units } from '@open-garden/shared-types';

export const INCHES_PER_FOOT = 12;

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

/** Feet shown in number inputs, on half-foot steps (8, 4.5), never hundredths. */
export function inchesToFeetInput(inches: number): number {
  return Math.round(inchesToFeet(inches) * 2) / 2;
}

export function feetToInches(feet: string | number): number {
  const n = typeof feet === 'number' ? feet : Number.parseFloat(feet);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * INCHES_PER_FOOT);
}

export function formatFeet(inches: number): string {
  return String(inchesToFeetInput(inches));
}

const CM_PER_INCH = 2.54;
const FEET_PER_METRE = 1 / 0.3048;

/** The unit a plan length is typed and shown in. */
export function lengthUnit(units: Units): 'ft' | 'm' {
  return units === 'metric' ? 'm' : 'ft';
}

/** Input step for a plan length: half feet, or centimetres. */
export function lengthStep(units: Units): number {
  return units === 'metric' ? 0.01 : 0.5;
}

/** A stored length as typed: feet on half-foot steps, or metres to the centimetre. */
export function lengthInput(inches: number, units: Units): number {
  if (units === 'imperial') return inchesToFeetInput(inches);
  return Math.round(inches * CM_PER_INCH) / 100;
}

/** A typed plan length (feet or metres) in whole inches; 0 when it is not a number. */
export function inchesFromInput(value: string | number, units: Units): number {
  if (units === 'imperial') return feetToInches(value);
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round((n * 100) / CM_PER_INCH) : 0;
}

/** A typed plan length re-expressed after the member switches units. */
export function convertLength(value: number, from: Units, to: Units): number {
  return from === to ? value : lengthInput(inchesFromInput(value, from), to);
}

/** A plan length with its unit: "4.5 ft" or "1.37 m". */
export function formatLength(inches: number, units: Units): string {
  return `${lengthInput(inches, units)} ${lengthUnit(units)}`;
}

/** A plant's spacing: "12 in" or "30 cm". */
export function formatSpacing(inches: number, units: Units): string {
  return units === 'metric' ? `${Math.round(inches * CM_PER_INCH)} cm` : `${inches} in`;
}

/** A tree's spacing, stored in whole feet, as typed: feet, or metres to a tenth. */
export function treeSpacingInput(feet: number, units: Units): number {
  return units === 'metric' ? Math.round((feet / FEET_PER_METRE) * 10) / 10 : feet;
}

/** A typed tree spacing (feet or metres) in whole feet; 0 when it is not a number. */
export function feetFromTreeSpacing(value: string | number, units: Units): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(units === 'metric' ? n * FEET_PER_METRE : n);
}

export function formatPlanSize(
  lengthInches: number,
  widthInches: number,
  orientation?: number,
  units: Units = 'imperial',
): string {
  const size = `${lengthInput(lengthInches, units)} × ${lengthInput(widthInches, units)} ${lengthUnit(units)}`;
  if (orientation === undefined) return size;
  return `${size} · ${orientation}°`;
}
