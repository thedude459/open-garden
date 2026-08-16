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
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name })).toBeVisible();
}

test('cached calendar stays readable when calendar API is aborted', async ({ page }) => {
  await register(page, `cal-off-${Date.now()}@example.com`);
  await createFrostGarden(page, 'Cached calendar');
  await addFromCatalog(page, 'Cherry Tomato');
  await expect(page.getByText(/Indoor Feb 19 – Mar 4/)).toBeVisible();

  await page.route('**/api/gardens/**/calendar**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await expect(page.getByText(/Indoor Feb 19 – Mar 4/)).toBeVisible();

  await page.getByPlaceholder('Search catalog to add').fill('Spinach');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Spinach' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await expect(page.locator('article').filter({ hasText: 'Spinach' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to garden' }).click();
  await page.locator('input[name="lastDay"]').fill('29');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await page.unroute('**/api/gardens/**/calendar**');
  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByText(/Indoor Mar 4 – Mar 18/)).toBeVisible();
});

test('this-week emphasis follows view-time date on a cached calendar', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-20T15:00:00') });
  await register(page, `cal-clock-${Date.now()}@example.com`);
  await createFrostGarden(page, 'Clock bed');
  await addFromCatalog(page, 'Cherry Tomato');
  await expect(page.locator('article').filter({ hasText: 'Cherry Tomato' }).getByText('This week')).toBeVisible();

  await page.route('**/api/gardens/**/calendar**', (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-06-28T15:00:00'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const tomato = page.locator('article').filter({ hasText: 'Cherry Tomato' });
  await expect(tomato).toBeVisible();
  await expect(tomato.getByText('This week')).toHaveCount(0);
});

test('removed member drops stale calendar cache after reconnect', async ({ browser }) => {
  const stamp = Date.now();
  const owner = await newUser(browser, `cal-stale-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `cal-stale-friend-${stamp}@example.com`);

  await createFrostGarden(owner, 'Stale calendar');
  await addFromCatalog(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`cal-stale-friend-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`cal-stale-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Stale calendar/ }).click();
  await friend.getByRole('link', { name: 'Calendar' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  const calendarUrl = friend.url();

  await friend.route('**/api/gardens/**/calendar**', (route) => route.abort());
  await owner.getByRole('button', { name: 'Remove' }).click();
  await expect(owner.getByText(`cal-stale-friend-${stamp}@example.com`)).toHaveCount(0);

  await friend.unroute('**/api/gardens/**/calendar**');
  await friend.goto(calendarUrl);
  await expect(friend.getByText(/Garden unavailable or not found/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
});
