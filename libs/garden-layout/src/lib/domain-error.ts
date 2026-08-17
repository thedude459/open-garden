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

export const LAYOUT_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  bedNotFound: () => domainError('NOT_FOUND', 'Bed not found'),
  plantingNotFound: () => domainError('NOT_FOUND', 'Planting not found'),
  geometryRequired: () => domainError('VALIDATION_ERROR', 'Bed size and position are required'),
  sizeMin: () => domainError('VALIDATION_ERROR', 'Bed length and width must be at least 1 inch'),
  rotationInvalid: () =>
    domainError('VALIDATION_ERROR', 'Bed rotation must be 0, 90, 180, or 270 degrees'),
  placementRequired: () => domainError('VALIDATION_ERROR', 'Placement position is required'),
  spacingProblems: () =>
    domainError('VALIDATION_ERROR', 'Layout has spacing or fit problems', 422),
  viewerLayout: () => domainError('FORBIDDEN', 'Viewers cannot update layout'),
} as const;
