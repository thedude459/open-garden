import { expect, test } from '@playwright/test';
import { signedInViaLoginForm } from './session';

test('signing out ends the session on the server, not just in the browser', async ({ browser }) => {
  const page = await signedInViaLoginForm(browser, `signout-${Date.now()}@example.com`);
  const [session] = (await page.context().cookies()).filter((c) => c.name === 'og_session');
  expect(session, 'signed in with a session cookie').toBeTruthy();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();

  // A signed-in page now sends the browser back to sign-in.
  await page.goto('/gardens');
  await expect(page).toHaveURL(/\/login/);

  // The old cookie is dead server-side: replaying it is refused.
  const replay = await page.context().request.get('/api/gardens', {
    headers: { cookie: `og_session=${session!.value}` },
  });
  expect(replay.status()).toBe(401);
});
