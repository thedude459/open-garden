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

async function abortReminders(page: Page) {
  await page.route('**/api/gardens/**/reminders**', (route) => route.abort());
}

async function restoreReminders(page: Page) {
  await page.unroute('**/api/gardens/**/reminders**');
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

async function openRemindersWithPlant(page: Page, gardenName: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(gardenName);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(gardenName) }).click();
  await page.getByRole('link', { name: 'Plantings' }).click();
  await page.getByPlaceholder('Search catalog to add').fill('Cherry Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Cherry Tomato' }).click();
  const tomato = page.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await tomato.locator('input[type="date"]').first().evaluate((el) => {
    const field = el as HTMLInputElement;
    field.value = '2026-01-01';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await goToReminders(page);
  await expect(page.getByText('Harvest')).toBeVisible();
}

test('offline cache readable; pending complete syncs for another member', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `rem-off-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `rem-off-friend-${stamp}@example.com`);

  await openRemindersWithPlant(owner, 'Offline reminders');
  await abortReminders(owner);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.getByText('Harvest')).toBeVisible();

  await owner.getByRole('button', { name: 'Complete' }).click();
  await expect(owner.getByText('pending')).toBeVisible();

  await restoreReminders(owner);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.getByText('pending')).toHaveCount(0);
  await expect(owner.getByText('Harvest')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`rem-off-friend-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Offline reminders/ }).click();
  await friend.getByRole('link', { name: 'Reminders' }).click();
  await expect(friend.getByText('Harvest')).toHaveCount(0);
});

test('viewer offline reads cache; membership loss drops cache', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `rem-off2-owner-${stamp}@example.com`);
  const collab = await newUser(browser, `rem-off2-collab-${stamp}@example.com`);

  await openRemindersWithPlant(owner, 'Membership loss');
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`rem-off2-collab-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('collaborator');
  await owner.getByRole('button', { name: 'Invite' }).click();

  await collab.goto('/gardens');
  await collab.getByRole('link', { name: /Membership loss/ }).click();
  await collab.getByRole('link', { name: 'Reminders' }).click();
  await expect(collab.getByText('Harvest')).toBeVisible();

  await abortReminders(collab);
  await collab.reload({ waitUntil: 'domcontentloaded' });
  await expect(collab.getByText('Harvest')).toBeVisible();
  await expect(collab.getByRole('button', { name: 'Complete' })).toBeVisible();

  await owner.goto('/gardens');
  await owner.getByRole('link', { name: /Membership loss/ }).click();
  await owner.getByRole('button', { name: 'Remove' }).click();
  await restoreReminders(collab);
  await collab.reload({ waitUntil: 'domcontentloaded' });
  await expect(collab.getByText(/Garden unavailable|not found/i)).toBeVisible();
});
