import { defineConfig } from '@playwright/test';
import databaseConfig from './playwright.database.config';
import { checkoutPreviewSettings } from './playwright/support/preview-checkout-http';

// Separate discovery and opt-in: the existing six lookup tests stay read-only in HTTP.
checkoutPreviewSettings(process.env);
export default defineConfig({
  ...databaseConfig,
  testDir: './playwright/checkout-database',
  testMatch: ['**/compra.spec.ts'],
  fullyParallel: false, workers: 1, retries: 0, repeatEach: 1, timeout: 120_000,
  use: { ...databaseConfig.use, trace: 'off', video: 'off', screenshot: 'off' },
});
