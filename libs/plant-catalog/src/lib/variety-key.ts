export function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildVarietyKey(species: string, cultivar: string | null | undefined): string {
  return `${normalizePart(species)}|${normalizePart(cultivar ?? '')}`;
}
