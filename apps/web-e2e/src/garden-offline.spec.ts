import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { openConfiguration } from './planner-helpers';



test('cached garden list and detail stay readable when the API is unreachable', async ({
  browser,
}) => {
  const page = await newUser(browser, `off-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Cached bed');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.getByRole('link', { name: /Cached bed/ }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await page.goto('/gardens');
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.route('**/api/gardens**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.getByPlaceholder('Garden name').fill('Offline fail');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
});

test('after reconnect, a removed member does not keep cached garden access', async ({
  browser,
}) => {
  const stamp = Date.now();
  const ownerEmail = `off-rejoin-owner-${stamp}@example.com`;
  const friendEmail = `off-rejoin-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Stale cache plot');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Stale cache plot/ }).click();
  await openConfiguration(owner);
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Stale cache plot/ })).toBeVisible();
  await friend.getByRole('link', { name: /Stale cache plot/ }).click();
  await openConfiguration(friend);
  await expect(friend.getByText(/You are collaborator/i)).toBeVisible();
  const gardenUrl = friend.url();
  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Stale cache plot/ })).toBeVisible();

  await friend.route('**/api/gardens**', (route) => route.abort());
  await owner.getByRole('button', { name: 'Remove' }).click();
  await expect(owner.getByText(friendEmail)).toHaveCount(0);

  await friend.unroute('**/api/gardens**');
  await friend.reload({ waitUntil: 'domcontentloaded' });
  await expect(friend.getByText(/No gardens yet/i)).toBeVisible();
  await expect(friend.getByRole('link', { name: /Stale cache plot/ })).toHaveCount(0);
  await friend.goto(gardenUrl);
  await expect(friend.getByText(/Garden unavailable|not found/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save garden' })).toHaveCount(0);
});
