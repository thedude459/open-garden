import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import {
  saveGarden,
  openConfiguration,
  openCalendar,
  confirmFixtureAddress,
} from './planner-helpers';

async function createFrostGarden(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill(name);
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await openConfiguration(page);
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 9' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await saveGarden(page);
  await page.getByRole('link', { name: 'Calendar' }).click();
}

async function addFromCatalog(page: Page, name: string) {
  await page
    .getByRole('textbox', { name: 'Search catalog to add' })
    // Search by common name; a variety reads "Tomato (Cherry)".
    .fill(name.replace(/ \(.*\)$/, ''));
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name })).toBeVisible();
}

test('add from favorites and catalog, filter, remove, zone mismatch, no duplicates', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const ownerEmail = `cal-plants-owner-${stamp}@example.com`;
  const friendEmail = `cal-plants-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner.getByRole('link', { name: /Basil \(Genovese\)/ }).click();
  await owner.getByRole('button', { name: 'Save favorite' }).click();
  await expect(owner.getByRole('button', { name: 'Remove favorite' })).toBeVisible();

  await createFrostGarden(owner, 'Picker bed');
  await owner.getByRole('button', { name: 'Show favorites' }).click();
  await expect(owner.getByRole('heading', { name: 'Your favorites' })).toBeVisible();
  await owner.getByRole('button', { name: 'Add favorite Basil (Genovese)' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Basil (Genovese)' })).toBeVisible();

  await addFromCatalog(owner, 'Tomato (Cherry)');
  await addFromCatalog(owner, 'Dill (Bouquet)');
  // Zone 9: rhubarb is hardy to 8, strawberry to 9.
  await addFromCatalog(owner, 'Rhubarb (Victoria)');
  await addFromCatalog(owner, 'Strawberry (Albion)');
  await addFromCatalog(owner, 'Tomato (Cherry)');
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toHaveCount(1);

  await expect(
    owner.locator('article').filter({ hasText: 'Rhubarb (Victoria)' }).getByText('Zone mismatch'),
  ).toBeVisible();
  await expect(
    owner.locator('article').filter({ hasText: 'Strawberry (Albion)' }).getByText('Zone mismatch'),
  ).toHaveCount(0);

  await owner.locator('select[name="plantTypeFilter"]').selectOption('vegetable');
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Dill (Bouquet)' })).toHaveCount(0);

  await owner.locator('select[name="plantTypeFilter"]').selectOption('tree');
  await expect(owner.getByText(/No plants match this type/)).toBeVisible();
  await owner.getByRole('button', { name: 'Clear filter' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Dill (Bouquet)' })).toBeVisible();

  await owner.getByRole('button', { name: 'Remove Dill (Bouquet)' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Dill (Bouquet)' })).toHaveCount(0);
  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Dill');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await expect(owner.getByRole('link', { name: /Dill \(Bouquet\)/ })).toBeVisible();

  await owner.getByRole('link', { name: 'Properties' }).click();
  await owner.getByRole('link', { name: /Picker bed/ }).click();
  await openConfiguration(owner);
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Picker bed/ })).toBeVisible();
  await friend.getByRole('link', { name: /Picker bed/ }).click();
  await openCalendar(friend);
  await expect(friend.getByText('Basil (Genovese)')).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Show favorites' })).toHaveCount(0);
  await expect(friend.getByText('Your favorites')).toHaveCount(0);
});
