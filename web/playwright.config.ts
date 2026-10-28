import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end UI tests against a running API and web app.
 *
 * Both servers are reused when already up (the usual local setup — see the
 * README "Run" section) and started otherwise. Tests run serially: they share
 * one seeded database, and several of them change appointment state.
 *
 * Prerequisite: `npm run seed` in backend/ so the demo accounts exist.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.CURA_WEB_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'npm run dev:backend',
      cwd: '..',
      // There is no health route; an authenticated endpoint answering 401 is
      // enough, and Playwright counts 401 as "ready".
      url: 'http://localhost:3000/api/account/profile',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:web',
      cwd: '..',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
