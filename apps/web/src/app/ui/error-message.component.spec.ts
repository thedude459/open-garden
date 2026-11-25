import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { domainError } from '@open-garden/shared-types';
import { apiMessage, errorMessage, UserFacingError } from './error-message';

const apiError = (error: unknown, status = 400) =>
  new HttpErrorResponse({ error, status, url: '/api/gardens' });

describe('errorMessage', () => {
  it("shows the API's reason", () => {
    const err = apiError({ error: { code: 'CONFLICT', message: 'That name is taken' } }, 409);
    expect(errorMessage(err, 'Could not save')).toBe('That name is taken');
  });

  it('reads the reason from a text response', () => {
    const err = apiError(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Chore not found' } }),
    );
    expect(apiMessage(err)).toBe('Chore not found');
  });

  it("never shows Angular's own text for a failed request", () => {
    expect(errorMessage(apiError(null, 0), 'Could not save')).toBe('Could not save');
    expect(errorMessage(apiError('<html>Bad gateway</html>', 502), 'Could not save')).toBe(
      'Could not save',
    );
    expect(errorMessage(apiError({ message: 'Cannot GET /x' }, 404), 'Could not save')).toBe(
      'Could not save',
    );
  });

  it('shows the message of an error written for people', () => {
    expect(
      errorMessage(new UserFacingError('You need to be online to make this change'), 'x'),
    ).toBe('You need to be online to make this change');
  });

  it('shows the message of a rule shared with the API', () => {
    const err = domainError('VALIDATION_ERROR', 'Harvest date must be on or after planted date');
    expect(errorMessage(err, 'Could not save')).toBe(
      'Harvest date must be on or after planted date',
    );
  });

  it('hides a browser storage failure', () => {
    const err = new DOMException('The transaction was aborted', 'AbortError');
    expect(errorMessage(err, 'Could not save')).toBe('Could not save');
  });

  it("hides a browser error's technical text", () => {
    expect(
      errorMessage(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        'Could not save',
      ),
    ).toBe('Could not save');
  });

  it('falls back for anything else', () => {
    expect(errorMessage('boom', 'Could not save')).toBe('Could not save');
    expect(errorMessage(new UserFacingError(''), 'Could not save')).toBe('Could not save');
  });
});
