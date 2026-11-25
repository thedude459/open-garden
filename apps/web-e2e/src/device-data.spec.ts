import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { confirmFixtureAddress } from './planner-helpers';
import { signedInViaLoginForm, TEST_PASSWORD, uniqueEmail } from './session';

/** A second member, registered apart from the browser under test. */
async function registerOther(request: APIRequestContext, prefix: string): Promise<string> {
  const email = uniqueEmail(prefix);
  const res = await request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, displayName: 'Other' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return email;
}

/** Creates a property and opens it, so its page is saved on the device. Returns its address. */
async function createProperty(page: Page, name: string): Promise<string> {
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill(name);
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function signInByForm(page: Page, email: string) {
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * With the API unreachable only this device's saved copies can answer: the
 * property list, and the last member's property page, whose address is in
 * the browser's history on a shared device.
 */
async function expectNothingOfOffline(page: Page, name: string, address: string) {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/gardens', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
  // A count of none holds at once, before the page has read its saved copy.
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0);
  await page.goto(address, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(name)).toHaveCount(0);
}

const ourDatabases = (page: Page) =>
  page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name).filter((name) => name?.startsWith('og-')),
  );

test('signing out leaves none of the member’s gardens on the device', async ({
  browser,
  request,
}) => {
  const other = await registerOther(request, 'device-next');
  const page = await signedInViaLoginForm(browser, uniqueEmail('device-first'));
  const address = await createProperty(page, 'First member plot');
  expect(await ourDatabases(page)).toContain('og-gardens');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Asked again until the sign-in page has finished loading.
  await expect.poll(() => ourDatabases(page)).toEqual([]);

  await signInByForm(page, other);
  await expectNothingOfOffline(page, 'First member plot', address);
});

test('another member signing in after a session ended sees none of the last one’s gardens', async ({
  browser,
  request,
}) => {
  const other = await registerOther(request, 'device-after');
  const page = await signedInViaLoginForm(browser, uniqueEmail('device-before'));
  const address = await createProperty(page, 'Earlier member plot');

  // The session ends on the server, as when it expires; nobody signs out.
  expect((await page.context().request.post('/api/auth/logout')).status()).toBe(204);
  await page.goto('/gardens');
  await expect(page).toHaveURL(/\/login/);

  await signInByForm(page, other);
  await expectNothingOfOffline(page, 'Earlier member plot', address);
});
