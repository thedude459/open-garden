export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN';

export function domainError(code: DomainErrorCode, message: string): Error & { code: DomainErrorCode } {
  const err = new Error(message) as Error & { code: DomainErrorCode };
  err.code = code;
  return err;
}

export const PLANTING_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  plantNotFound: () => domainError('NOT_FOUND', 'Plant not found'),
  plantingNotFound: () => domainError('NOT_FOUND', 'Planting not found'),
  bedNotFound: () => domainError('NOT_FOUND', 'Bed not found'),
  plantRequired: () => domainError('VALIDATION_ERROR', 'Plant is required'),
  dateInvalid: () => domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD'),
  harvestBeforePlanted: () =>
    domainError('VALIDATION_ERROR', 'Harvest date must be on or after planted date'),
  bedNameRequired: () => domainError('VALIDATION_ERROR', 'Bed name is required'),
  bedNameTooLong: () => domainError('VALIDATION_ERROR', 'Bed name must be at most 120 characters'),
  bedNameTaken: () => domainError('CONFLICT', 'That garden already has a bed with that name'),
  idInUse: () => domainError('CONFLICT', 'That id is already in use'),
  viewerPlantings: () => domainError('FORBIDDEN', 'Viewers cannot update plantings'),
  viewerBeds: () => domainError('FORBIDDEN', 'Viewers cannot update beds'),
} as const;
