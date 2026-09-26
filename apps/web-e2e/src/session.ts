import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const TEST_PASSWORD = 'password123';
const ORIGIN = 'http://localhost:4200';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

type AuthUser = { id: string; email: string; role: string };

function ogSessionFromHeaders(res: { headersArray: () => { name: string; value: string }[] }): string {
  for (const header of res.headersArray()) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    const first = header.value.split(';')[0]?.trim() ?? '';
    if (first.toLowerCase().startsWith('og_session=')) {
      return decodeURIComponent(first.slice('og_session='.length));
    }
  }
  throw new Error('register succeeded without og_session cookie');
}

async function registerOnPage(page: Page, email: string): Promise<AuthUser> {
  const res = await page.request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, displayName: 'E2E' },
  });
  const text = await res.text();
  expect(res.ok(), text).toBeTruthy();
  await page.context().addCookies([
    {
      name: 'og_session',
      value: ogSessionFromHeaders(res),
      url: ORIGIN,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  const body = JSON.parse(text) as { user: AuthUser };
  await page.goto('/gardens');
  await page.evaluate((user) => {
    sessionStorage.setItem('og_user_id', user.id);
    sessionStorage.setItem('og_role', user.role);
    sessionStorage.setItem('og_authed', '1');
  }, body.user);
  return body.user;
}

export async function signedInContext(
  browser: Browser,
  email = uniqueEmail(),
): Promise<{ context: BrowserContext; email: string }> {
  const page = await signedInPage(browser, email);
  return { context: page.context(), email };
}

export async function signedInPage(browser: Browser, email = uniqueEmail()): Promise<Page> {
  const context = await browser.newContext({ baseURL: ORIGIN, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('/');
  await registerOnPage(page, email);
  return page;
}
