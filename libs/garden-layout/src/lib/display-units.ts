export const INCHES_PER_FOOT = 12;

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

/** Feet shown in number inputs, rounded to the nearest hundredth. */
export function inchesToFeetInput(inches: number): number {
  return Math.round(inchesToFeet(inches) * 100) / 100;
}

export function feetToInches(feet: string | number): number {
  const n = typeof feet === 'number' ? feet : Number.parseFloat(feet);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * INCHES_PER_FOOT);
}

export function formatFeet(inches: number): string {
  return String(inchesToFeetInput(inches));
}

export function formatPlanSize(
  lengthInches: number,
  widthInches: number,
  orientation?: number,
): string {
  const size = `${formatFeet(lengthInches)} × ${formatFeet(widthInches)} ft`;
  if (orientation === undefined) return size;
  return `${size} · ${orientation}°`;
}
