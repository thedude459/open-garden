import { formatWeight } from '@open-garden/garden-layout';
import type { Units } from '@open-garden/shared-types';

/** A harvest or a total as read: "2.4 lb", "6 picked", "2.4 lb and 6 picked", or "—". */
export function harvestAmount(
  amount: { grams: number | null; count: number | null },
  units: Units,
): string {
  const parts: string[] = [];
  if (amount.grams) parts.push(formatWeight(amount.grams, units));
  if (amount.count) parts.push(`${amount.count} picked`);
  return parts.length ? parts.join(' and ') : '—';
}
