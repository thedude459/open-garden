import { expect, test } from '@playwright/test';
import { signedInViaLoginForm, uniqueEmail, TEST_PASSWORD } from './session';

test('a member changes their password from Account and signs in with it', async ({ browser }) => {
  const email = uniqueEmail('account-pw');
  const page = await signedInViaLoginForm(browser, email);
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

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
