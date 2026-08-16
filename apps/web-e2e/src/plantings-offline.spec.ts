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

async function openPlantings(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.getByRole('link', { name: 'Plantings' }).click();
}

async function addFromCatalog(page: Page, name: string) {
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

async function abortPlantingApis(page: Page) {
  await page.route('**/api/gardens/**/plantings**', (route) => route.abort());
  await page.route('**/api/gardens/**/beds**', (route) => route.abort());
}

async function restorePlantingApis(page: Page) {
  await page.unroute('**/api/gardens/**/plantings**');
  await page.unroute('**/api/gardens/**/beds**');
}

test('offline cache stays readable and queued add syncs for another member', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `plant-off-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `plant-off-friend-${stamp}@example.com`);

  await openPlantings(owner, 'Offline plot');
  await addFromCatalog(owner, 'Cherry Tomato');
  await owner.getByPlaceholder('Bed name').fill('Raised bed 1');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toBeVisible();

  await abortPlantingApis(owner);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();

  await addFromCatalog(owner, 'Sweet Basil');
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' }).getByText('pending')).toBeVisible();
  await owner.getByPlaceholder('Bed name').fill('Patio pots');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('heading', { name: /Patio pots/ })).toBeVisible();

  await restorePlantingApis(owner);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' }).getByText('pending')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`plant-off-friend-${stamp}@example.com`);
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`plant-off-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Offline plot/ }).click();
  await friend.getByRole('link', { name: 'Plantings' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();
});

test('pending patch of a remotely deleted planting fails visibly and does not recreate', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `plant-nr-a-${stamp}@example.com`);
  const friend = await newUser(browser, `plant-nr-b-${stamp}@example.com`);

  await openPlantings(owner, 'No resurrect');
  await addFromCatalog(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`plant-nr-b-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('collaborator');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`plant-nr-b-${stamp}@example.com`)).toBeVisible();
  await owner.getByRole('link', { name: 'Plantings' }).click();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /No resurrect/ }).click();
  await friend.getByRole('link', { name: 'Plantings' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();

  await abortPlantingApis(owner);
  const tomato = owner.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await fillDate(tomato.locator('input[type="date"]').first(), '2026-05-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.getByText('pending')).toBeVisible();
  await addFromCatalog(owner, 'Sweet Basil');
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' }).getByText('pending')).toBeVisible();

  const friendTomato = friend.locator('article').filter({ hasText: 'Cherry Tomato' });
  await friendTomato.getByRole('button', { name: 'Remove Cherry Tomato' }).click();
  await friendTomato.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(0);

  await restorePlantingApis(owner);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.getByText(/needs-attention/)).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(0);
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();

  await friend.reload();
  await expect(friend.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(0);
});

test('viewer offline reads cache; removed collaborator drops cache after reconnect', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `plant-stale-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `plant-stale-viewer-${stamp}@example.com`);
  const collab = await newUser(browser, `plant-stale-collab-${stamp}@example.com`);

  await openPlantings(owner, 'Stale plantings');
  await addFromCatalog(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`plant-stale-viewer-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`plant-stale-viewer-${stamp}@example.com`)).toBeVisible();
  await owner.locator('input[name="inviteEmail"]').fill(`plant-stale-collab-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('collaborator');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`plant-stale-collab-${stamp}@example.com`)).toBeVisible();

  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Stale plantings/ }).click();
  await viewer.getByRole('link', { name: 'Plantings' }).click();
  await expect(viewer.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await abortPlantingApis(viewer);
  await viewer.reload({ waitUntil: 'domcontentloaded' });
  await expect(viewer.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  await restorePlantingApis(viewer);

  await collab.goto('/gardens');
  await collab.getByRole('link', { name: /Stale plantings/ }).click();
  await collab.getByRole('link', { name: 'Plantings' }).click();
  await expect(collab.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  const plantingsUrl = collab.url();
  await abortPlantingApis(collab);

  await owner
    .locator('li.row')
    .filter({ hasText: `plant-stale-collab-${stamp}@example.com` })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(owner.getByText(`plant-stale-collab-${stamp}@example.com`)).toHaveCount(0);

  await restorePlantingApis(collab);
  await collab.goto(plantingsUrl);
  await expect(collab.getByText(/Garden unavailable or not found/i)).toBeVisible();
  await expect(collab.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
});
