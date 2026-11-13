/**
 * Dates as the reader's browser language and region write them, through the
 * platform's Intl formatter: "May 1, 2026", "1 May 2026", "1. Mai 2026".
 * Stored dates are calendar days (YYYY-MM-DD), so they are read and written
 * in UTC and never shift with the time zone.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A stored day ("2026-05-01") with its year; other text unchanged, nothing for none. */
export function formatDay(iso: string | null | undefined, locale?: string): string {
  if (iso == null) return '';
  const match = ISO_DAY.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** A day of no particular year, such as a sowing window's edge: "May 1", "1 mai". */
export function formatMonthDay(md: { month: number; day: number }, locale?: string): string {
  // A leap year, so 29 February formats.
  const date = new Date(Date.UTC(2024, md.month - 1, md.day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(date);
}
