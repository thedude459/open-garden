import { domainError } from '@open-garden/garden-layout';
import { seasonQuerySchema } from '@open-garden/shared-types';

/** The `season` query parameter (ADR 0040), or undefined for the current season. */
export function season(raw: string | undefined): number | undefined {
  const parsed = seasonQuerySchema.safeParse({ season: raw });
  if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Season must be a year');
  return parsed.data.season;
}
