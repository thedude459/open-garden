import type { SoilPhDto, SoilTestDto } from '@open-garden/shared-types';

/** Below this, a garden soil benefits from compost; 3–5% is the usual target. */
export const LOW_ORGANIC_MATTER_PCT = 3;
/** Soil changes slowly; extension services advise a new test every 2–3 years. */
export const RETEST_AFTER_YEARS = 3;

const ph = (value: number) => value.toFixed(1);

/**
 * Advice when the bed's tested pH is outside the crop's range (ADR 0033).
 * Direction only, no rates: those depend on texture and buffer pH, so the
 * lab's recommendation wins.
 */
export function phAdvice(
  name: string,
  bedPh: number | null | undefined,
  range: SoilPhDto | null | undefined,
): string | null {
  if (bedPh == null || !range) return null;
  if (bedPh >= range.min && bedPh <= range.max) return null;
  const fix = bedPh < range.min ? 'raise it with lime' : 'lower it with sulfur over a season';
  return `${name} needs pH ${ph(range.min)}–${ph(range.max)}; this bed tested ${ph(bedPh)}: ${fix}`;
}

const NUTRIENTS = [
  ['nitrogen', 'Nitrogen'],
  ['phosphorus', 'Phosphorus'],
  ['potassium', 'Potassium'],
] as const;

/** Notes on a bed's latest test, for its inspector. */
export function soilTestNotes(test: SoilTestDto, today: string): string[] {
  const notes: string[] = [];
  if (test.organicMatterPct != null && test.organicMatterPct < LOW_ORGANIC_MATTER_PCT) {
    notes.push(
      `Organic matter is ${test.organicMatterPct}%: work in compost each year to raise it toward 3–5%.`,
    );
  }
  const low = NUTRIENTS.filter(([key]) => test[key] === 'low').map(([, label]) => label);
  if (low.length) {
    const what = low.join(' and ').replace(/ and (?=.* and )/, ', ');
    const verb = low.length === 1 ? 'is' : 'are';
    notes.push(
      `${what} ${verb} low: ${test.recommendations ? 'follow the lab’s recommendation' : 'ask the lab or your extension office how much to add'}.`,
    );
  }
  const years = (Date.parse(today) - Date.parse(test.testedOn)) / (365.25 * 86_400_000);
  if (years >= RETEST_AFTER_YEARS) {
    notes.push(
      `Tested ${Math.floor(years)} years ago: soil changes, so test again every 2–3 years.`,
    );
  }
  return notes;
}
