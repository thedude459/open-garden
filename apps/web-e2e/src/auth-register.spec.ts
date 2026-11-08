import { test, expect } from '@playwright/test';
import { TEST_PASSWORD, uniqueEmail } from './session';

test('signing up with an email that already has an account says so', async ({ page }) => {
  const email = uniqueEmail('taken');
  const first = await page.request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, displayName: 'First' },
  });
  expect(first.status(), await first.text()).toBe(201);
  await page.context().clearCookies();

  await page.goto(`/login?email=${encodeURIComponent(email)}&register=1`);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByLabel('Notification')).toContainText(
    'An account with this email already exists',
  );
  await expect(page).toHaveURL(/\/login/);
});
