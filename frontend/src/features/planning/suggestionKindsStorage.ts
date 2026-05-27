export const ALL_PLANT_KINDS = ["vegetable", "herb", "flower", "fruit"] as const;

export type PlantKind = (typeof ALL_PLANT_KINDS)[number];

const STORAGE_PREFIX = "seasonalSuggestionKinds:";

function isPlantKind(value: string): value is PlantKind {
  return (ALL_PLANT_KINDS as readonly string[]).includes(value);
}

export function readStoredSuggestionKinds(gardenId: number): PlantKind[] {
  if (typeof localStorage === "undefined") {
    return [...ALL_PLANT_KINDS];
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gardenId}`);
    if (!raw) {
      return [...ALL_PLANT_KINDS];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...ALL_PLANT_KINDS];
    }
    const kinds = parsed.filter((item): item is PlantKind => typeof item === "string" && isPlantKind(item));
    const uniq = [...new Set(kinds)];
    return uniq.length > 0 ? uniq : [...ALL_PLANT_KINDS];
  } catch {
    return [...ALL_PLANT_KINDS];
  }
}

export function writeStoredSuggestionKinds(gardenId: number, kinds: readonly PlantKind[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${gardenId}`, JSON.stringify([...kinds].sort()));
  } catch {
    /* ignore quota */
  }
}

/** Cache/API signature: `full` when all kinds selected (no query filter). */
export function suggestionKindsSignature(kinds: readonly PlantKind[]): string {
  const sorted = [...new Set(kinds)].sort();
  const allSorted = [...ALL_PLANT_KINDS].slice().sort();
  if (sorted.length === allSorted.length && sorted.every((k, i) => k === allSorted[i])) {
    return "full";
  }
  return sorted.join("|");
}

/** Single `suggestion_kinds` CSV query unless all kinds are active (avoids repeated keys dropped by some proxies). */
export function suggestionKindsSearchSuffix(kinds: readonly PlantKind[]): string {
  if (suggestionKindsSignature(kinds) === "full") {
    return "";
  }
  const csv = [...new Set(kinds)].sort().join(",");
  return `?suggestion_kinds=${encodeURIComponent(csv)}`;
}
