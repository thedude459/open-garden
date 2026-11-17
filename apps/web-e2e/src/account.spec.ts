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
