import { test, expect } from '@playwright/test';

const stacked = process.env['STACK_E2E'] === '1';

test.describe('stacked compose origin', () => {
  test.use({ baseURL: 'http://127.0.0.1:8080' });

  test('landing or sign-in is visible', async ({ page }) => {
    test.skip(!stacked, 'set STACK_E2E=1 against http://127.0.0.1:8080');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Sign in|Gardens/i })).toBeVisible();
  });
});
