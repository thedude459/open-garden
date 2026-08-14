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
