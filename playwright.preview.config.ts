import { defineConfig, devices } from '@playwright/test';
import { previewSettings } from './src/lib/preview-safety';

// Evaluated before browser startup: missing configuration fails, never silently skips.
const settings = previewSettings(process.env);
export default defineConfig({
  testDir: './playwright/preview', timeout: 60_000, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: settings.baseURL, serviceWorkers: 'block',
    // Traces could retain the bypass token; sanitized JSON is attached instead.
    trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'preview-chromium', use: { ...devices['Desktop Chrome'] } }],
});
