import { domainError } from '@open-garden/shared-types';

export { domainError };

export const LAYOUT_ERRORS = {
  gardenNotFound: () => domainError('NOT_FOUND', 'Garden not found'),
  bedNotFound: () => domainError('NOT_FOUND', 'Bed not found'),
  plantingNotFound: () => domainError('NOT_FOUND', 'Planting not found'),
  seasonOutOfRange: () => domainError('VALIDATION_ERROR', 'Plan this season or the next one'),
  geometryRequired: () => domainError('VALIDATION_ERROR', 'Bed size and position are required'),
  sizeMin: () => domainError('VALIDATION_ERROR', 'Bed length and width must be at least 1 inch'),
  rotationInvalid: () =>
    domainError('VALIDATION_ERROR', 'Bed rotation must be 0, 90, 180, or 270 degrees'),
  placementRequired: () => domainError('VALIDATION_ERROR', 'Placement position is required'),
  spacingProblems: () => domainError('VALIDATION_ERROR', 'Layout has spacing or fit problems', 422),
  viewerLayout: () => domainError('FORBIDDEN', 'Viewers cannot update layout'),
  areaNotFound: () => domainError('NOT_FOUND', 'Area not found'),
  areaNameRequired: () => domainError('VALIDATION_ERROR', 'Area name is required'),
  areaNameTooLong: () =>
    domainError('VALIDATION_ERROR', 'Area name must be at most 120 characters'),
  areaNameTaken: () =>
    domainError('CONFLICT', 'That garden already has an area with that name', 409),
} as const;
