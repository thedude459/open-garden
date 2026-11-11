import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { openPlantingsFromGarden, confirmFixtureAddress } from './planner-helpers';

async function openPlantings(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill(name);
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await openPlantingsFromGarden(page);
}

async function fillDate(input: ReturnType<Page['locator']>, value: string) {
  await input.evaluate((el, next) => {
    const field = el as HTMLInputElement;
    field.value = next;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function addFromCatalog(page: Page, name: string) {
  await page
    .getByRole('textbox', { name: 'Search catalog to add' })
    // Search by common name; a variety reads "Tomato (Cherry)".
    .fill(name.replace(/ \(.*\)$/, ''));
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

test('record plantings, dates, confirm remove, favorites picker, viewer read-only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const ownerEmail = `plant-rec-owner-${stamp}@example.com`;
  const friendEmail = `plant-rec-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner.getByRole('link', { name: /Basil \(Genovese\)/ }).click();
  await owner.getByRole('button', { name: 'Save favorite' }).click();
  await expect(owner.getByRole('button', { name: 'Remove favorite' })).toBeVisible();

  await openPlantings(owner, 'Record bed');
  await addFromCatalog(owner, 'Tomato (Cherry)');
  const tomato = owner.locator('article').filter({ hasText: 'Tomato (Cherry)' }).first();
  await expect(tomato.getByText('Not set').first()).toBeVisible();
  const planted = tomato.locator('input[type="date"]').first();
  await expect(planted).toHaveValue('');
  const today = new Date().toISOString().slice(0, 10);
  await expect(planted).not.toHaveValue(today);

  await fillDate(planted, '2026-04-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-04-01');

  await fillDate(planted, '2026-12-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-12-01');

  await fillDate(tomato.locator('input[name^="harvested-"]'), '2026-12-15');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[name^="harvested-"]')).toHaveValue('2026-12-15');

  await fillDate(tomato.locator('input[name^="harvested-"]'), '2026-01-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(owner.getByText(/Harvest date must be on or after planted date/)).toBeVisible();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-12-01');
  await expect(tomato.locator('input[type="date"]').nth(1)).toHaveValue('2026-12-15');

  await addFromCatalog(owner, 'Tomato (Cherry)');
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toHaveCount(2);

  await owner.getByRole('button', { name: 'Show favorites' }).click();
  await owner.getByRole('button', { name: 'Add favorite Basil (Genovese)' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Basil (Genovese)' })).toBeVisible();

  const basil = owner.locator('article').filter({ hasText: 'Basil (Genovese)' });
  await basil.getByRole('button', { name: 'Remove Basil (Genovese)' }).click();
  await basil.getByRole('button', { name: 'Cancel' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Basil (Genovese)' })).toBeVisible();
  await basil.getByRole('button', { name: 'Remove Basil (Genovese)' }).click();
  await basil.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Basil (Genovese)' })).toHaveCount(0);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Tomato');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await expect(owner.getByRole('link', { name: /Tomato \(Cherry\)/ })).toBeVisible();
  await owner.goto('/favorites');
  await expect(owner.getByText('Basil (Genovese)')).toBeVisible();
  await owner.getByRole('link', { name: 'Properties' }).click();
  await owner.getByRole('link', { name: /Record bed/ }).click();
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toHaveCount(0);

  await owner.getByRole('link', { name: 'Configuration' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Record bed/ }).click();
  await openPlantingsFromGarden(friend);
  await expect(
    friend.locator('article').filter({ hasText: 'Tomato (Cherry)' }).first(),
  ).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Show favorites' })).toHaveCount(0);
  await expect(friend.getByText('Your favorites')).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
});
