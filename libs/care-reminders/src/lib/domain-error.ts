import { domainError } from '@open-garden/shared-types';

export { domainError };

export const CARE_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  plantingNotFound: () => domainError('NOT_FOUND', 'Planting not found'),
  dateRequired: () => domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD'),
  careKindRequired: () => domainError('VALIDATION_ERROR', 'Care kind is required'),
  viewerReminders: () => domainError('FORBIDDEN', 'Viewers cannot update reminders'),
} as const;
