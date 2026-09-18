import type { APIResponse, Route } from '@playwright/test';

// Header overrides on route.continue() survive redirects. Fetch exactly once
// instead, and never expose a redirect response to the browser for following.
export async function fulfillProtectedAppRoute(
  route: Pick<Route, 'request' | 'fetch' | 'fulfill' | 'abort'>,
  deploymentOrigin: string,
  appHeaders: Record<string, string>,
  recordRedirect: (status: number) => Promise<void>,
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== deploymentOrigin || url.username || url.password) {
    throw new Error('Protected headers require the exact deployment origin without credentials.');
  }
  let response: APIResponse;
  try {
    response = await route.fetch({
      headers: { ...request.headers(), ...appHeaders },
      maxRedirects: 0, maxRetries: 0, timeout: 30_000,
    });
  } catch {
    await route.abort();
    throw new Error('Protected application request failed; request headers and cause omitted.');
  }
  try {
    const status = response.status();
    if (status >= 300 && status < 400) {
      try {
        await recordRedirect(status);
      } finally {
        await route.abort('blockedbyresponse');
      }
      return;
    }
    await route.fulfill({ response });
  } finally {
    await response.dispose();
  }
}
