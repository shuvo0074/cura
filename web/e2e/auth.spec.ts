import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ACCOUNTS, navButton, testMobile, watchErrors } from './helpers';

/** A real UI login in the test's own page — used only where the login itself is under test. */
async function uiLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Mobile number or email').fill(ACCOUNTS.admin.identifier);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNTS.admin.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Modules' })).toBeVisible();
}

test.describe('Welcome page', () => {
  test('opens on the Login tab with Register beside it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');

    const tabs = page.getByRole('tablist', { name: 'Welcome' });
    await expect(tabs.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText(/Remember me for 30 days/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Help and legal' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rejects an empty login without calling the API', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Modules' })).toHaveCount(0);
  });

  test('shows an error for a wrong password', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Mobile number or email').fill(ACCOUNTS.admin.identifier);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Modules' })).toHaveCount(0);
  });

  test('Register tab validates every mandatory field', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Register' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    for (const label of ['Mobile number or email', 'BMDC registration number', 'Full name', 'Password', 'Confirm password']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    // Facebook is shown but honestly disabled — there is no OAuth on the API.
    await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeDisabled();

    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByLabel('BMDC registration number')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Password', { exact: true }).fill('Abcdefg123');
    await page.getByLabel('Confirm password').fill('Different123');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByLabel('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  });

  // Goes through the shared role sessions, so these logins are reused by the
  // rest of the run instead of spending the login throttle twice.
  test('each role signs in and lands on the calendar', async ({ signIn }) => {
    for (const role of ['admin', 'doctor', 'desk'] as const) {
      const page = await signIn(role);
      await expect(navButton(page, 'Calendar')).toHaveAttribute('aria-current', 'page');
    }
  });

  // Its own page and context: logging out revokes the session, which must not
  // be one the other tests share.
  test('logout asks for confirmation', async ({ page }) => {
    await uiLogin(page);
    const nav = page.getByRole('navigation', { name: 'Modules' });

    await nav.getByRole('button', { name: 'Log out' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log out?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(nav).toBeVisible();

    await nav.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('dialog', { name: 'Log out?' }).getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('tab', { name: 'Login' })).toBeVisible();
  });

  /**
   * Full registration needs the OTP, which the development SMS driver prints
   * to the API console. Point CURA_API_LOG at that output to enable this test;
   * it creates a real account each run (and the API allows 5 per 15 minutes).
   */
  test('registers a doctor through OTP into onboarding', async ({ page }) => {
    const logPath = process.env.CURA_API_LOG;
    test.skip(!logPath, 'Set CURA_API_LOG to the API console log to run the OTP flow');

    const mobile = testMobile('0171');
    const tail = mobile.slice(-8);
    const before = fs.readFileSync(logPath as string, 'utf8').length;

    await page.goto('/');
    await page.getByRole('tab', { name: 'Register' }).click();
    await page.getByLabel('Mobile number or email').fill(mobile);
    await page.getByLabel('BMDC registration number').fill(`E2E${tail.slice(-5)}`);
    await page.getByLabel('Full name').fill('Dr. E2E Tester');
    await page.getByLabel('Password', { exact: true }).fill('E2eDoctor2026');
    await page.getByLabel('Confirm password').fill('E2eDoctor2026');
    await page.getByRole('button', { name: 'Register', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Confirm your account' })).toBeVisible();

    let code: string | undefined;
    await expect
      .poll(() => {
        const fresh = fs.readFileSync(logPath as string, 'utf8').slice(before);
        const line = fresh.split('\n').reverse().find((l) => l.includes(tail));
        code = line?.match(/\b(\d{6})\b/)?.[1];
        return code;
      })
      .toBeTruthy();

    await page.getByLabel('Verification code').fill(code as string);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText(/Step 1 of 4/i)).toBeVisible();
  });
});
