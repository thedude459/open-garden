import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { confirmFixtureAddress } from './planner-helpers';

async function goToReminders(page: Page) {
  const onGardenDetail = page.getByRole('link', { name: 'Tasks', exact: true });
  if (await onGardenDetail.isVisible()) {
    await onGardenDetail.click();
  } else {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
}

async function setupGardenWithTomato(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill(name);
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.getByRole('link', { name: 'Plantings', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Tomato (Cherry)' }).click();
  const tomato = page.locator('article').filter({ hasText: 'Tomato (Cherry)' }).first();
  await tomato
    .locator('input[type="date"]')
    .first()
    .evaluate((el) => {
      const field = el as HTMLInputElement;
      field.value = '2026-01-01';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  // Wait for the save to reach the server: Reminders reads the planting date from it.
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        /\/plantings\/[^/]+$/.test(new URL(r.url()).pathname) &&
        r.ok(),
    ),
    tomato.getByRole('button', { name: 'Save planting' }).click(),
  ]);
  await goToReminders(page);
}

test('collaborator completes harvest; planting remains; viewer read-only', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `rem-done-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `rem-done-friend-${stamp}@example.com`);

  await setupGardenWithTomato(owner, 'Complete plot');
  await expect(owner.getByText('Harvest')).toBeVisible();

  await owner.getByRole('link', { name: 'Settings', exact: true }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`rem-done-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('collaborator');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`rem-done-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await expect(friend.getByRole('link', { name: /Complete plot/ })).toBeVisible();
  await friend.getByRole('link', { name: /Complete plot/ }).click();
  await friend.getByRole('link', { name: 'Tasks', exact: true }).click();
  await friend
    .locator('li')
    .filter({ hasText: 'Harvest' })
    .getByRole('button', { name: 'Complete' })
    .click();
  await expect(friend.getByText('Harvest')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(owner.getByText('Harvest')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Settings', exact: true }).click();
  await owner.getByRole('link', { name: 'Plantings', exact: true }).click();
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toBeVisible();
  await expect(owner.locator('input[name^="harvested-"]').first()).not.toHaveValue('');
});
