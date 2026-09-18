import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/e2e', timeout: 60_000, fullyParallel: true,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI, retries: 0, workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block',
    actionTimeout: 5_000, navigationTimeout: 10_000,
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './playwright/support/global-setup.ts',
});
