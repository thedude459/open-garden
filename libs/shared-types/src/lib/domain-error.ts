/** What went wrong, in terms the API maps to an HTTP status in one place. */
export type DomainErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN';

export type DomainError = Error & { code: DomainErrorCode; httpStatus?: number };

/** An error a service throws for the API to answer; `httpStatus` overrides the code's usual one. */
export function domainError(
  code: DomainErrorCode,
  message: string,
  httpStatus?: number,
): DomainError {
  const err = new Error(message) as DomainError;
  err.code = code;
  if (httpStatus !== undefined) err.httpStatus = httpStatus;
  return err;
}
