import { domainError } from '@open-garden/shared-types';

export { domainError };

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
  indoorStartRequired: () =>
    domainError('VALIDATION_ERROR', 'Indoor start date is required for transplants'),
  indoorStartForbidden: () =>
    domainError('VALIDATION_ERROR', 'Direct seed plantings cannot have an indoor start date'),
  seasonOutOfRange: () => domainError('VALIDATION_ERROR', 'Plan this season or the next one'),
  repeatNeedsSowDate: () =>
    domainError('VALIDATION_ERROR', 'Give the planting a sow date before repeating it'),
  repeatAnnualsOnly: () => domainError('VALIDATION_ERROR', 'Only annual plantings repeat'),
  repeatNothing: (lastSowOn: string | null) =>
    domainError(
      'VALIDATION_ERROR',
      lastSowOn
        ? `No sowing fits before that date in this crop's sowing windows; the last that ripens before frost is ${lastSowOn}`
        : "No sowing fits before that date in this crop's sowing windows",
    ),
  repeatTooMany: (max: number) =>
    domainError('VALIDATION_ERROR', `A series adds at most ${max} sowings; pick an earlier date`),
  bedSizeRequired: () =>
    domainError('VALIDATION_ERROR', 'Bed length and width must be at least 1 inch'),
} as const;
