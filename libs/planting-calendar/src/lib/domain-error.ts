import { AREA_TYPES, type AreaKind } from '@open-garden/shared-types';

import { domainError } from '@open-garden/shared-types';

export { domainError };

export const CALENDAR_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  plantNotFound: () => domainError('NOT_FOUND', 'Plant not found'),
  plantRequired: () => domainError('VALIDATION_ERROR', 'Plant is required'),
  seasonOutOfRange: () => domainError('VALIDATION_ERROR', 'Plan this season or the next one'),
  viewerForbidden: () => domainError('FORBIDDEN', 'Viewers cannot update this calendar'),
  areaRequired: (area: AreaKind) =>
    domainError('VALIDATION_ERROR', `Add ${AREA_TYPES[area].name} for this plant first`),
} as const;
