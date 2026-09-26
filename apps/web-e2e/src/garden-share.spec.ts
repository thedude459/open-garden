import { test, expect } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { saveGarden, openConfiguration, openOverview } from './planner-helpers';

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
  await expect(owner.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await openConfiguration(owner);
  await expect(owner.locator('input[name="name"]')).toBeVisible();
  await expect(owner.locator('textarea[name="notes"]')).toBeVisible();
  await expect(owner.locator('select[name="zone"]')).toBeVisible();
  await expect(owner.locator('select[name="lastMonth"]')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Invite' })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Delete garden' })).toBeVisible();
  await owner.locator('textarea[name="notes"]').fill('Owner notes');
  await saveGarden(owner);
  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await expect(owner.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await openConfiguration(owner);
  await expect(owner.locator('textarea[name="notes"]')).toHaveValue('Owner notes');
  await owner.locator('input[name="inviteEmail"]').fill(`nobody-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(/does not have an account/i)).toBeVisible();
  await owner.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await owner.getByRole('button', { name: 'Copy join link' }).click();
  await expect(owner.getByLabel('Notification')).toContainText('Join link copied');
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Shared yard/ })).toBeVisible();
  await friend.getByRole('link', { name: /Shared yard/ }).click();
  await openOverview(friend);
  await openConfiguration(friend);
  await expect(friend.getByText(/You are collaborator/i)).toBeVisible();
  await friend.locator('textarea[name="notes"]').fill('Collaborator notes');
  await saveGarden(friend);
  await expect(friend.locator('textarea[name="notes"]')).toHaveValue('Collaborator notes');
  await expect(friend.getByPlaceholder('Member email')).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Delete garden' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Invite' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Make viewer' }).click();
  await expect(owner.getByLabel('Notification')).toContainText('Role updated');
  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Shared yard/ }).click();
  await expect(friend.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await openConfiguration(friend);
  await expect(friend.getByText(/You are viewer/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save garden' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Invite' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Delete garden' })).toHaveCount(0);
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
  await openConfiguration(owner);
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
  await openConfiguration(owner);
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();
  await owner.locator('input[name="inviteEmail"]').fill(extraEmail);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(extraEmail)).toBeVisible();

  await extra.goto('/gardens');
  await extra.getByRole('link', { name: /Transfer plot/ }).click();
  await openConfiguration(extra);
  await expect(extra.getByText(/You are collaborator/i)).toBeVisible();
  await extra.getByRole('button', { name: 'Leave garden' }).click();
  await expect(extra.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await expect(extra.getByRole('link', { name: /Transfer plot/ })).toHaveCount(0);

  await owner.reload();
  await expect(owner.locator('li.row', { hasText: extraEmail })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Transfer ownership' }).click();
  await expect(owner.getByLabel('Notification')).toContainText('Ownership transferred');
  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Transfer plot/ }).click();
  await openConfiguration(friend);
  await expect(friend.getByText(/You are owner/i)).toBeVisible();
  await owner.reload();
  await expect(owner.getByText(/You are collaborator/i)).toBeVisible();

  await friend.getByRole('button', { name: 'Remove' }).click();
  await expect(friend.getByText(ownerEmail)).toHaveCount(0);
  await owner.goto('/gardens');
  await expect(owner.getByRole('link', { name: /Transfer plot/ })).toHaveCount(0);
});
