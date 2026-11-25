import { domainError } from '@open-garden/shared-types';

export { domainError };

export const PIPELINE_ERRORS = {
  adminRequired: () => domainError('FORBIDDEN', 'Admin role required'),
  alreadyRunning: () => domainError('CONFLICT', 'A pipeline run is already running'),
  runNotFound: () => domainError('NOT_FOUND', 'Pipeline run not found'),
} as const;
