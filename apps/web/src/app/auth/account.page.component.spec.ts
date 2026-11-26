import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NoticeService } from '../ui/notice.service';
import { AccountPage } from './account.page';
import { settled } from '../settled';

async function render() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', children: [] }]),
    ],
  });
  const fixture = TestBed.createComponent(AccountPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const type = (name: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async (current: string, next: string, repeat = next) => {
    type('currentPassword', current);
    type('newPassword', next);
    type('repeatPassword', repeat);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settled(fixture);
  };
  return { fixture, el, submit, http: TestBed.inject(HttpTestingController) };
}

describe('AccountPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the current and new password and says other devices are signed out', async () => {
    const { submit, http, fixture } = await render();
    await submit('password123', 'new-password-1');
    const req = http.expectOne('/api/account/password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      currentPassword: 'password123',
      newPassword: 'new-password-1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() =>
      expect(TestBed.inject(NoticeService).current()?.message).toContain(
        'Other devices are signed out',
      ),
    );
    expect(fixture.nativeElement.querySelector('input[name="newPassword"]').value).toBe('');
  });

  it('checks the new password before asking the server', async () => {
    const { submit, el, http } = await render();
    await submit('password123', 'short');
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('at least 8 characters');
    await submit('password123', 'new-password-1', 'new-password-2');
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('do not match');
    http.expectNone('/api/account/password');
  });

  it('shows the server’s reason when the current password is wrong', async () => {
    const { submit, el, http } = await render();
    await submit('guess', 'new-password-1');
    http
      .expectOne('/api/account/password')
      .flush(
        { error: { code: 'VALIDATION_ERROR', message: 'The current password is not right.' } },
        { status: 400, statusText: 'Bad Request' },
      );
    await vi.waitFor(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'The current password is not right.',
      ),
    );
  });

  it('deletes the account after the password and goes to sign-in', async () => {
    const { fixture, el, http } = await render();
    sessionStorage.setItem('og_authed', '1');
    const button = (name: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
    button('Delete account').click();
    await settled(fixture);
    const input = el.querySelector<HTMLInputElement>('input[name="deletePassword"]')!;
    input.value = 'password123';
    input.dispatchEvent(new Event('input'));
    button('Delete my account permanently').click();
    await settled(fixture);
    const req = http.expectOne('/api/account');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 'password123' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(sessionStorage.getItem('og_authed')).toBeNull();
  });

  it('names the shared properties that stop the deletion', async () => {
    const { fixture, el, http } = await render();
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Delete account')!
      .click();
    await settled(fixture);
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Delete my account permanently')!
      .click();
    await settled(fixture);
    http
      .expectOne('/api/account')
      .flush(
        { error: { code: 'CONFLICT', message: 'Others belong to Shared plot.' } },
        { status: 409, statusText: 'Conflict' },
      );
    await vi.waitFor(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Shared plot'),
    );
  });
});
