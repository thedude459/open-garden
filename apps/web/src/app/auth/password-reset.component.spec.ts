import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Type } from '@angular/core';
import { NoticeService } from '../ui/notice.service';
import { ForgotPasswordPage } from './forgot-password.page';
import { LoginPage } from './login.page';
import { ResetPasswordPage } from './reset-password.page';
import { settled } from '../settled';

const TOKEN = 'd'.repeat(64);

async function render<T>(page: Type<T>, url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'login', component: LoginPage },
        { path: 'forgot-password', component: ForgotPasswordPage },
        { path: 'reset-password', component: ResetPasswordPage },
        { path: '**', children: [] },
      ]),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(page);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const type = (name: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settled(fixture);
  };
  return { fixture, el, type, submit, http: TestBed.inject(HttpTestingController) };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('Forgot password on sign-in', () => {
  it('shows the link only where the server can email one', async () => {
    const off = await render(LoginPage, '/login');
    off.http.expectOne('/api/auth/password-reset').flush({ byEmail: false });
    await settled(off.fixture);
    expect(off.el.textContent).not.toContain('Forgot password?');
    TestBed.resetTestingModule();

    const on = await render(LoginPage, '/login?email=a%40example.com');
    on.http.expectOne('/api/auth/password-reset').flush({ byEmail: true });
    await vi.waitFor(() =>
      expect(on.el.querySelector('a[href^="/forgot-password"]')?.getAttribute('href')).toBe(
        '/forgot-password?email=a@example.com',
      ),
    );
  });
});

describe('ForgotPasswordPage', () => {
  it('asks for a link and says the same whether or not the address has an account', async () => {
    const view = await render(ForgotPasswordPage, '/forgot-password?email=a%40example.com');
    expect(view.el.querySelector<HTMLInputElement>('input[name="email"]')!.value).toBe(
      'a@example.com',
    );
    await view.submit();
    const req = view.http.expectOne('/api/auth/password-reset');
    expect(req.request.body).toEqual({ email: 'a@example.com' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() =>
      expect(view.el.querySelector('[role="status"]')?.textContent).toContain(
        'If an account uses a@example.com',
      ),
    );
  });

  it('passes on the server’s reason, such as too many requests', async () => {
    const view = await render(ForgotPasswordPage, '/forgot-password');
    view.type('email', 'a@example.com');
    await view.submit();
    view.http
      .expectOne('/api/auth/password-reset')
      .flush(
        { error: { message: 'Too many attempts. Try again in 15 minutes.' } },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await vi.waitFor(() =>
      expect(view.el.querySelector('[role="alert"]')?.textContent).toContain('Too many attempts'),
    );
  });
});

describe('ResetPasswordPage', () => {
  it('sets the password with the link’s token and goes to sign-in', async () => {
    const view = await render(ResetPasswordPage, `/reset-password?token=${TOKEN}`);
    view.type('password', 'new-password-1');
    view.type('repeat', 'new-password-2');
    await view.submit();
    expect(view.el.querySelector('[role="alert"]')!.textContent).toContain('do not match');
    view.http.expectNone('/api/auth/password-reset/confirm');

    view.type('repeat', 'new-password-1');
    await view.submit();
    const req = view.http.expectOne('/api/auth/password-reset/confirm');
    expect(req.request.body).toEqual({ token: TOKEN, password: 'new-password-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(TestBed.inject(NoticeService).current()?.message).toContain('Sign in with the new one');
  });

  it('says when the link has expired or was used', async () => {
    const view = await render(ResetPasswordPage, `/reset-password?token=${TOKEN}`);
    view.type('password', 'new-password-1');
    view.type('repeat', 'new-password-1');
    await view.submit();
    view.http.expectOne('/api/auth/password-reset/confirm').flush(
      {
        error: { message: 'This reset link has expired or was already used. Ask for a new one.' },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await vi.waitFor(() =>
      expect(view.el.querySelector('[role="alert"]')?.textContent).toContain('expired'),
    );
  });
});
