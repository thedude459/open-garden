import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPage } from './login.page';

async function render(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'login', component: LoginPage },
        { path: '**', children: [] },
      ]),
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  const fixture = TestBed.createComponent(LoginPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return { fixture, router, http: TestBed.inject(HttpTestingController) };
}

async function signIn(view: Awaited<ReturnType<typeof render>>) {
  const el: HTMLElement = view.fixture.nativeElement;
  const type = (name: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  type('email', 'gardener@example.com');
  type('password', 'password123');
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
  await view.fixture.whenStable();
  view.http
    .expectOne('/api/auth/login')
    .flush({ user: { id: 'u1', email: 'gardener@example.com', role: 'member' } });
  await view.fixture.whenStable();
}

describe('LoginPage', () => {
  afterEach(() => sessionStorage.clear());

  it('says the session ended only when sent here for that', async () => {
    const plain = await render('/login');
    expect(plain.fixture.nativeElement.textContent).not.toContain('Your session ended');
    TestBed.resetTestingModule();
    const expired = await render('/login?expired=1');
    expect(expired.fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Your session ended',
    );
  });

  it('goes to Today after signing in', async () => {
    const view = await render('/login');
    await signIn(view);
    await vi.waitFor(() => expect(view.router.url).toBe('/today'));
  });

  it('returns to the page the session ended on, but never to another site', async () => {
    const back = await render('/login?expired=1&returnUrl=%2Fgardens%2Fabc%2Flayout');
    await signIn(back);
    await vi.waitFor(() => expect(back.router.url).toBe('/gardens/abc/layout'));
    TestBed.resetTestingModule();
    const evil = await render('/login?returnUrl=%2F%2Fevil.example');
    await signIn(evil);
    await vi.waitFor(() => expect(evil.router.url).toBe('/today'));
  });
});
