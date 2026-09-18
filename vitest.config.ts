import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://velo-e2e.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test_only',
    },
  },
});
