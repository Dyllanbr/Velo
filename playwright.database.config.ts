import { defineConfig } from '@playwright/test';
import previewConfig from './playwright.preview.config';
import { previewDatabaseSettings } from './playwright/support/preview-database';

// Validate before browser startup, without connecting or reading a general .env.
previewDatabaseSettings(process.env);
export default defineConfig({
  ...previewConfig,
  testDir: './playwright/database',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: 1,
});
