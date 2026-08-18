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

export const PIPELINE_ERRORS = {
  adminRequired: () => domainError('FORBIDDEN', 'Admin role required'),
  alreadyRunning: () => domainError('CONFLICT', 'A pipeline run is already running'),
  runNotFound: () => domainError('NOT_FOUND', 'Pipeline run not found'),
  invalidSettings: () => domainError('VALIDATION_ERROR', 'Invalid pipeline settings'),
} as const;
