import { HttpErrorResponse } from '@angular/common/http';

/** An error whose message is written for people, so it can be shown as is. */
export class UserFacingError extends Error {}

/**
 * The API's own message for a failed request, if it sent one. Every API error
 * is `{ error: { code, message } }`; a request that asked for text gets that
 * JSON as a string.
 */
export function apiMessage(err: unknown): string | undefined {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  let body: unknown = err.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' && message ? message : undefined;
}

/**
 * What to tell the member when something fails: the API's reason, the
 * message of an error written for people (a {@link UserFacingError}, or a
 * domain error from a rule shared with the API, which carries a string
 * `code`), or the fallback. Never Angular's "Http failure response for …",
 * nor a browser error's technical text.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) return apiMessage(err) ?? fallback;
  if (!(err instanceof Error) || !err.message) return fallback;
  const forPeople =
    err instanceof UserFacingError || typeof (err as { code?: unknown }).code === 'string';
  return forPeople ? err.message : fallback;
}
