import { HttpErrorResponse } from '@angular/common/http';
import { OnlineRequiredError } from './gardens-api.service';

/** What to tell the member when a change to a property fails. */
export function gardenErrorMessage(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not update garden';
}
