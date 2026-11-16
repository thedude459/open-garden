import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

const unauthorized = { status: 401, statusText: 'Unauthorized' };

async function setup(url = '/gardens/abc/layout') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', children: [] }]),
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  return {
    router,
    auth: TestBed.inject(AuthApiService),
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
  };
}

/** Sign in through the service, as the login page does. */
async function signIn(t: Awaited<ReturnType<typeof setup>>) {
  const done = t.auth.login('gardener@example.com', 'password123');
  t.backend.expectOne('/api/auth/login').flush({ user: { id: 'u1', email: 'g', role: 'member' } });
  await done;
}

describe('sessionExpiredInterceptor', () => {
  afterEach(() => sessionStorage.clear());

  it('forgets the sign-in and goes to sign-in, remembering the page', async () => {
    const t = await setup();
    await signIn(t);
    const call = firstValueFrom(t.http.get('/api/gardens')).catch((err) => err.status);
    t.backend.expectOne('/api/gardens').flush(null, unauthorized);
    // The caller still gets its error.
    expect(await call).toBe(401);
    expect(t.auth.isAuthenticated()).toBe(false);
    await vi.waitFor(() =>
      expect(t.router.url).toBe('/login?expired=1&returnUrl=%2Fgardens%2Fabc%2Flayout'),
    );
  });

  it('leaves a wrong password alone', async () => {
    const t = await setup('/login');
    sessionStorage.setItem('og_authed', '1');
    const call = t.auth.login('gardener@example.com', 'nope').catch(() => 'refused');
    t.backend.expectOne('/api/auth/login').flush(null, unauthorized);
    expect(await call).toBe('refused');
    expect(t.auth.isAuthenticated()).toBe(true);
    expect(t.router.url).toBe('/login');
  });

  it('ignores a late 401 for a request sent before signing in again', async () => {
    const t = await setup();
    await signIn(t);
    const stale = firstValueFrom(t.http.get('/api/gardens/today')).catch((err) => err.status);
    const pending = t.backend.expectOne('/api/gardens/today');
    await signIn(t);
    pending.flush(null, unauthorized);
    expect(await stale).toBe(401);
    expect(t.auth.isAuthenticated()).toBe(true);
    expect(t.router.url).toBe('/gardens/abc/layout');
  });

  it('does nothing when nobody is signed in', async () => {
    const t = await setup('/login');
    const call = firstValueFrom(t.http.get('/api/gardens')).catch((err) => err.status);
    t.backend.expectOne('/api/gardens').flush(null, unauthorized);
    expect(await call).toBe(401);
    expect(t.router.url).toBe('/login');
  });
});
