import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { confirmFixtureAddress } from './planner-helpers';
import { signedInPage, signedInViaLoginForm, uniqueEmail, TEST_PASSWORD } from './session';

test('a member changes their password from Account and signs in with it', async ({ browser }) => {
  const email = uniqueEmail('account-pw');
  const page = await signedInViaLoginForm(browser, email);
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();

  await page.getByLabel('Current password').fill('not-it');
  await page.getByRole('textbox', { name: /^New password/ }).fill('new-password-1');
  await page.getByLabel('Repeat new password').fill('new-password-1');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('alert')).toHaveText('The current password is not right.');

  await page.getByLabel('Current password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed. Other devices are signed out.')).toBeVisible();
  // This session stays signed in.
  await page.getByRole('link', { name: 'Today' }).first().click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Authentication failed')).toBeVisible();
  await page.getByPlaceholder('Password').fill('new-password-1');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('a member deletes their account and cannot sign in again', async ({ browser }) => {
  const email = uniqueEmail('account-delete');
  const page = await signedInPage(browser, email);
  await page.getByPlaceholder('Property name').fill('Leaving plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await expect(page.getByRole('link', { name: /Leaving plot/ })).toBeVisible();

  await page.goto('/account');
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByLabel('Your password').fill('not-it');
  await page.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(page.getByRole('alert')).toHaveText('The password is not right.');
  await page.getByLabel('Your password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Your account is deleted.')).toBeVisible();

  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Authentication failed')).toBeVisible();
});

test('a reset link from the reset-link command sets a new password', async ({ page }) => {
  const email = uniqueEmail('account-reset');
  const registered = await page.request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD },
  });
  expect(registered.ok()).toBeTruthy();
  await page.context().clearCookies();
  // Without SMTP (as here), sign-in offers no "Forgot password?"; the server's
  // operator runs this command and passes the link on.
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
  const out = execFileSync('node', ['dist/api-runtime/reset-link.js', email], {
    encoding: 'utf8',
  });
  const path = /\/reset-password\?token=[0-9a-f]{64}/.exec(out)![0];

  await page.goto(path);
  await page.getByRole('textbox', { name: /^New password/ }).fill('reset-password-1');
  await page.getByLabel('Repeat new password').fill('reset-password-1');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByText('Password changed. Sign in with the new one.')).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('reset-password-1');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  // The link works once.
  await page.goto(path);
  await page.getByRole('textbox', { name: /^New password/ }).fill('reset-password-2');
  await page.getByLabel('Repeat new password').fill('reset-password-2');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByRole('alert')).toContainText('expired or was already used');
});
