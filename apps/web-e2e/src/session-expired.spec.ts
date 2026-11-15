import { expect, test } from '@playwright/test';
import { signedInViaLoginForm } from './session';

test('a session that ended on the server sends you to sign in, then back where you were', async ({
  browser,
}) => {
  const email = `expired-${Date.now()}@example.com`;
  const page = await signedInViaLoginForm(browser, email);
  // Let the catalog finish loading, so no request is in flight when the
  // session ends.
  const catalog = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/plants' && res.ok(),
  );
  await page.goto('/plants');
  await catalog;
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();

  // The server ends the session (as when it expires); the browser still
  // believes it is signed in.
  expect((await page.context().request.post('/api/auth/logout')).status()).toBe(204);

  // The next page's API call is refused: sign in, not an empty page.
  await page.goto('/gardens');
  await expect(page).toHaveURL(/\/login\?.*expired=1/);
  await expect(page.getByRole('status').filter({ hasText: 'Your session ended' })).toBeVisible();
  await expect(page.getByText('No properties yet')).toHaveCount(0);

  // Signing in again returns to the page the session ended on.
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/gardens$/);
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
});

test('a wrong password on the sign-in page is not treated as an ended session', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(`nobody-${Date.now()}@example.com`);
  await page.getByPlaceholder('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Authentication failed')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
