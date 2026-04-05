export function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hasValidationErrors(errors: Record<string, string>) {
  return Object.values(errors).some(Boolean);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function toFeet(inches: number) {
  return `${(inches / 12).toFixed(1)} ft`;
}
