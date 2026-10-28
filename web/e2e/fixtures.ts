import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { ACCOUNTS, type Role } from './helpers';

/**
 * Role sessions shared across a run.
 *
 * `/auth/login` is throttled to 10 calls per 15 minutes per client, and refresh
 * tokens rotate with reuse detection — both real security controls. So each
 * role signs in once per worker, in its own browser context, and every test
 * opens a new page in that context: the page restores its session from the
 * context's (rotating) refresh cookie instead of logging in again.
 */
type Fixtures = { signIn: (role?: Role) => Promise<Page> };
type WorkerFixtures = { sessions: Map<Role, BrowserContext> };

export const test = base.extend<Fixtures, WorkerFixtures>({
  sessions: [
    async ({ browser }, use) => {
      const sessions = new Map<Role, BrowserContext>();
      await use(sessions);
      await Promise.all([...sessions.values()].map((c) => c.close()));
    },
    { scope: 'worker' },
  ],

  signIn: async ({ sessions, browser, baseURL }, use) => {
    const opened: Page[] = [];

    await use(async (role = 'admin') => {
      let context = sessions.get(role);
      const page = context ? await context.newPage() : await (context = await browser.newContext({ baseURL })).newPage();
      opened.push(page);

      if (!sessions.has(role)) {
        sessions.set(role, context);
        const account = ACCOUNTS[role];
        await page.goto('/');
        await page.getByLabel('Mobile number or email').fill(account.identifier);
        await page.getByLabel('Password', { exact: true }).fill(account.password);
        await page.getByRole('button', { name: 'Login', exact: true }).click();
      } else {
        await page.goto('/');
      }
      await expect(page.getByRole('navigation', { name: 'Modules' })).toBeVisible({ timeout: 15_000 });
      return page;
    });

    // Close this test's pages so the next test's page is the only one
    // refreshing the shared cookie.
    await Promise.all(opened.map((p) => p.close()));
  },
});

export { expect };
