import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { addTransplant } from './planner-helpers';



async function openReminders(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.getByRole('link', { name: 'Reminders' }).click();
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
}

async function goToReminders(page: Page) {
  const onGardenDetail = page.getByRole('link', { name: 'Reminders' });
  if (await onGardenDetail.isVisible()) {
    await onGardenDetail.click();
  } else {
    await page.getByRole('link', { name: 'Back to garden' }).click();
    await page.getByRole('link', { name: 'Reminders' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByRole('link', { name: 'Plantings' }).click();
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

async function fillDate(input: ReturnType<Page['locator']>, value: string) {
  await input.evaluate((el, next) => {
    const field = el as HTMLInputElement;
    field.value = next;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('reminders list: harvest, no moderate water, empty CTA, viewer read-only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `rem-list-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `rem-list-viewer-${stamp}@example.com`);

  await openReminders(owner, 'Reminder list');
  await expect(owner.getByText('Record plantings to see care reminders.')).toBeVisible();

  await addFromCatalog(owner, 'Cherry Tomato');
  const tomato = owner.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await fillDate(tomato.locator('input[type="date"]').first(), '2026-01-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();

  await goToReminders(owner);
  await expect(owner.getByText('Harvest')).toBeVisible();
  await expect(owner.locator('li').filter({ hasText: 'Cherry Tomato' }).getByText('Water')).toHaveCount(
    0,
  );

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`rem-list-viewer-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`rem-list-viewer-${stamp}@example.com`)).toBeVisible();
  await owner.getByRole('link', { name: 'Reminders' }).click();
  await expect(owner.getByRole('button', { name: 'Complete' })).toBeVisible();

  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Reminder list/ }).click();
  await viewer.getByRole('link', { name: 'Reminders' }).click();
  await expect(viewer.getByText('Harvest')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Complete' })).toHaveCount(0);
});

test('garden reminders list does not include indoor-only transplant tasks', async ({ browser }) => {
  test.setTimeout(60_000);
  const owner = await newUser(browser, `rem-indoor-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Indoor split');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Indoor split/ }).click();
  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Reminders' }).click();
  await expect(owner.getByRole('heading', { name: 'Reminders' })).toBeVisible();
  await expect(owner.locator('li').filter({ hasText: 'Cherry Tomato' })).toHaveCount(0);
});
