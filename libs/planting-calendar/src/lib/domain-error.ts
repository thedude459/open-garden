import { AREA_TYPES, type AreaKind } from '@open-garden/shared-types';

export type DomainErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN';

export function domainError(
  code: DomainErrorCode,
  message: string,
): Error & { code: DomainErrorCode } {
  const err = new Error(message) as Error & { code: DomainErrorCode };
  err.code = code;
  return err;
}

export const CALENDAR_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  plantNotFound: () => domainError('NOT_FOUND', 'Plant not found'),
  plantRequired: () => domainError('VALIDATION_ERROR', 'Plant is required'),
  viewerForbidden: () => domainError('FORBIDDEN', 'Viewers cannot update this calendar'),
  areaRequired: (area: AreaKind) =>
    domainError('VALIDATION_ERROR', `Add ${AREA_TYPES[area].name} for this plant first`),
} as const;
