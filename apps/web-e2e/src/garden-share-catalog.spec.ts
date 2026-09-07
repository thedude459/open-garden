import { test, expect } from '@playwright/test';
import { signedInPage } from './session';

test('sharing a garden does not share favorites; catalog stays available', async ({ browser }) => {
  const stamp = Date.now();
  const owner = await signedInPage(browser, `fav-owner-${stamp}@example.com`);
  const friend = await signedInPage(browser, `fav-friend-${stamp}@example.com`);

  await owner.goto('/plants');
  await expect(owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  await owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first().click();
  await owner.getByRole('button', { name: /favorite/i }).click();
  await owner.goto('/favorites');
  await expect(owner.getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await expect(owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i })).toBeVisible();

  await friend.goto('/favorites');
  await expect(friend.getByText(/No favorites yet/i)).toBeVisible();
  await friend.goto('/plants');
  await expect(
    friend.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first(),
  ).toBeVisible();
});
