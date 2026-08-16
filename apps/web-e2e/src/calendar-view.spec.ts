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

async function createFrostGarden(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Planting calendar' })).toBeVisible();
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

test('calendar ranges follow last vs first frost and keep unavailable plants', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `cal-view-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `cal-view-friend-${stamp}@example.com`);

  await createFrostGarden(owner, 'Season bed');
  await addFromCatalog(owner, 'Cherry Tomato');
  await addFromCatalog(owner, 'Spinach');
  await addFromCatalog(owner, 'Red Maple');
  await addFromCatalog(owner, 'French Marigold');

  await expect(owner.getByText(/Indoor Feb 19 – Mar 4/)).toBeVisible();
  await expect(owner.getByText(/Sow Aug 25 – Sep 8/)).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Red Maple' }).getByText(/Indoor unavailable/)).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('29');
  await owner.getByRole('button', { name: 'Save garden' }).click();
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(/Indoor Mar 4 – Mar 18/)).toBeVisible();
  await expect(owner.getByText(/Sow Aug 25 – Sep 8/)).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('15');
  await owner.locator('select[name="firstMonth"]').selectOption('11');
  await owner.locator('input[name="firstDay"]').fill('3');
  await owner.getByRole('button', { name: 'Save garden' }).click();
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(/Indoor Feb 19 – Mar 4/)).toBeVisible();
  await expect(owner.getByText(/Sow Sep 8 – Sep 22/)).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`cal-view-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`cal-view-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Season bed/ }).click();
  await friend.getByRole('link', { name: 'Calendar' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Remove / })).toHaveCount(0);

  await owner.locator('select[name="firstMonth"]').selectOption({ label: 'Month' });
  await owner.locator('input[name="firstDay"]').fill('');
  await owner.getByRole('button', { name: 'Save garden' }).click();
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(/Windows cannot be produced/)).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
});

test('this-week emphasis uses start windows only', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-04-15T15:00:00') });
  await register(page, `cal-week-${Date.now()}@example.com`);
  await createFrostGarden(page, 'Week bed');
  await addFromCatalog(page, 'French Marigold');
  await addFromCatalog(page, 'Cherry Tomato');
  const marigold = page.locator('article').filter({ hasText: 'French Marigold' });
  const tomato = page.locator('article').filter({ hasText: 'Cherry Tomato' });
  await expect(marigold.getByText('This week')).toBeVisible();
  await expect(tomato.getByText('This week')).toHaveCount(0);
});
