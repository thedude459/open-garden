export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN';

export function domainError(
  code: DomainErrorCode,
  message: string,
  httpStatus?: number,
): Error & { code: DomainErrorCode; httpStatus?: number } {
  const err = new Error(message) as Error & { code: DomainErrorCode; httpStatus?: number };
  err.code = code;
  if (httpStatus !== undefined) err.httpStatus = httpStatus;
  return err;
}

export const CARE_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  plantingNotFound: () => domainError('NOT_FOUND', 'Planting not found'),
  dateRequired: () => domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD'),
  careKindRequired: () => domainError('VALIDATION_ERROR', 'Care kind is required'),
  viewerReminders: () => domainError('FORBIDDEN', 'Viewers cannot update reminders'),
} as const;
