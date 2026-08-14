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
  await owner.locator('input[name="inviteEmail"]').fill(`nobody-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(/does not have an account/i)).toBeVisible();
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
  await expect(friend.getByRole('button', { name: 'Delete garden' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Make viewer' }).click();
  await friend.reload();
  await expect(friend.getByText(/You are viewer/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save garden' })).toHaveCount(0);
  await expect(friend.getByText(ownerEmail)).toBeVisible();
});

test('stranger cannot see a shared garden they were not invited to', async ({ browser }) => {
  const stamp = Date.now();
  const owner = await newUser(browser, `share-iso-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `share-iso-friend-${stamp}@example.com`);
  const stranger = await newUser(browser, `share-iso-stranger-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Household only');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Household only/ }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`share-iso-friend-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`share-iso-friend-${stamp}@example.com`)).toBeVisible();
  const gardenUrl = owner.url();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Household only/ })).toBeVisible();

  await stranger.goto('/gardens');
  await expect(stranger.getByRole('link', { name: /Household only/ })).toHaveCount(0);
  await stranger.goto(gardenUrl);
  await expect(stranger.getByText(/Garden unavailable|not found/i)).toBeVisible();
});

test('owner can transfer, collaborator can leave, owner can remove', async ({ browser }) => {
  const stamp = Date.now();
  const ownerEmail = `share-xfer-owner-${stamp}@example.com`;
  const friendEmail = `share-xfer-friend-${stamp}@example.com`;
  const extraEmail = `share-xfer-extra-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);
  const extra = await newUser(browser, extraEmail);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Transfer plot');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Transfer plot/ }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();
  await owner.locator('input[name="inviteEmail"]').fill(extraEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(extraEmail)).toBeVisible();

  await extra.goto('/gardens');
  await extra.getByRole('link', { name: /Transfer plot/ }).click();
  await expect(extra.getByText(/You are collaborator/i)).toBeVisible();
  await extra.getByRole('button', { name: 'Leave garden' }).click();
  await expect(extra.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await expect(extra.getByRole('link', { name: /Transfer plot/ })).toHaveCount(0);

  await owner.reload();
  await expect(owner.locator('li.row', { hasText: extraEmail })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Transfer ownership' }).click();
  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Transfer plot/ }).click();
  await expect(friend.getByText(/You are owner/i)).toBeVisible();
  await owner.reload();
  await expect(owner.getByText(/You are collaborator/i)).toBeVisible();

  await friend.getByRole('button', { name: 'Remove' }).click();
  await expect(friend.getByText(ownerEmail)).toHaveCount(0);
  await owner.goto('/gardens');
  await expect(owner.getByRole('link', { name: /Transfer plot/ })).toHaveCount(0);
});
