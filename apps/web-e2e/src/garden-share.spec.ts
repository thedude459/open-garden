import { test, expect, type Browser, type Page } from '@playwright/test';

async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

async function newUser(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await register(page, email);
  return page;
}

test('invite collaborator, demote to viewer, member list visible', async ({ browser }) => {
  const stamp = Date.now();
  const ownerEmail = `share-owner-${stamp}@example.com`;
  const friendEmail = `share-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Shared yard');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Shared yard/ }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Shared yard/ })).toBeVisible();
  await friend.getByRole('link', { name: /Shared yard/ }).click();
  await expect(friend.getByText(/You are collaborator/i)).toBeVisible();
  await friend.locator('textarea[name="notes"]').fill('Collaborator notes');
  await friend.getByRole('button', { name: 'Save garden' }).click();
  await expect(friend.locator('textarea[name="notes"]')).toHaveValue('Collaborator notes');
  await expect(friend.getByPlaceholder('Member email')).toHaveCount(0);

  await owner.getByRole('button', { name: 'Make viewer' }).click();
  await friend.reload();
  await expect(friend.getByText(/You are viewer/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save garden' })).toHaveCount(0);
  await expect(friend.getByText(ownerEmail)).toBeVisible();
});
