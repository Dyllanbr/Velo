import { createServer } from 'vite';

export default async function globalSetup() {
  // Own the server in this process: closes reliably on Windows without taskkill /T.
  // Explicit compile-time values prevent the developer's production .env from being used.
  const server = await createServer({
    mode: 'test',
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://velo-e2e.invalid'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_local_test_only'),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('local-test-only'),
    },
  });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  return async () => { await server.close(); };
}
