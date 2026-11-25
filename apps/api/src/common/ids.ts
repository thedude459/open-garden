import { ParseUUIDPipe } from '@nestjs/common';
import { domainError } from '@open-garden/shared-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route id can name a row at all; Postgres rejects anything else. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * A route id that must be a UUID. Anything else answers "<what> not found",
 * as a missing row does, instead of reaching Postgres and failing as a 500.
 */
export function idOf(what: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () => domainError('NOT_FOUND', `${what} not found`),
  });
}
