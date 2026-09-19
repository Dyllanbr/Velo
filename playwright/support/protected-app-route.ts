import type { Route } from '@playwright/test';

type ProtectedResponse = { status: number; headers: Record<string, string>; body: Buffer };
type ProtectedRoute = Pick<Route, 'request' | 'fulfill' | 'abort'>;

// Playwright records route.fetch/APIRequestContext call logs even when their
// thrown error is replaced. Keep protected headers out of that instrumentation.
export async function fetchProtectedApp(
  target: string,
  deploymentOrigin: string,
  headers: Record<string, string>,
  method = 'GET',
  body?: Buffer | null,
): Promise<ProtectedResponse> {
  let url: URL;
  try { url = new URL(target); } catch { throw new Error('Invalid protected application URL.'); }
  if (url.origin !== deploymentOrigin || url.username || url.password) {
    throw new Error('Protected headers require the exact deployment origin without credentials.');
  }
  try {
    const response = await fetch(url, {
      method, headers, body: body ? new Uint8Array(body) : undefined,
      redirect: 'manual', signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = Object.fromEntries(response.headers);
    // Native fetch decodes the body. Let route.fulfill compute its new length.
    delete responseHeaders['content-encoding'];
    delete responseHeaders['content-length'];
    delete responseHeaders['transfer-encoding'];
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return { status: response.status, headers: responseHeaders, body: Buffer.alloc(0) };
    }
    const chunks: Buffer[] = [];
    let length = 0;
    if (response.body) {
      const reader = response.body.getReader();
      let finished = false;
      try {
        while (!finished) {
          const chunk = await reader.read();
          finished = chunk.done;
          if (chunk.done) break;
          length += chunk.value.length;
          if (length > 25 * 1024 * 1024) throw new Error('Protected response exceeds limit.');
          chunks.push(Buffer.from(chunk.value));
        }
      } finally {
        try { if (!finished) await reader.cancel(); } finally { reader.releaseLock(); }
      }
    }
    return { status: response.status, headers: responseHeaders, body: Buffer.concat(chunks) };
  } catch {
    throw new Error('Protected application request failed; request headers and cause omitted.');
  }
}

// Never expose a redirect response to the browser for following.
export async function fulfillProtectedAppRoute(
  route: ProtectedRoute,
  deploymentOrigin: string,
  appHeaders: Record<string, string>,
  recordRedirect: (status: number) => Promise<void>,
): Promise<void> {
  const request = route.request();
  let response: ProtectedResponse;
  try {
    response = await fetchProtectedApp(request.url(), deploymentOrigin,
      { ...request.headers(), ...appHeaders }, request.method(), request.postDataBuffer());
  } catch {
    await route.abort();
    throw new Error('Protected application request failed; request headers and cause omitted.');
  }
  if (response.status >= 300 && response.status < 400) {
    try {
      await recordRedirect(response.status);
    } finally {
      await route.abort('blockedbyresponse');
    }
    return;
  }
  await route.fulfill(response);
}

// Leave the guard installed during shutdown: finish existing handlers and abort
// new requests instead of briefly allowing unguarded traffic before context.close.
export function createRouteLifecycle(handler: (route: Route) => Promise<void>) {
  const pending = new Set<Promise<void>>();
  let draining = false;
  let failed = false;
  let failure: unknown;
  return {
    handle(route: Route): Promise<void> {
      const work = Promise.resolve().then(() => draining ? route.abort() : handler(route));
      pending.add(work);
      void work.then(() => pending.delete(work), (error: unknown) => {
        pending.delete(work);
        if (!failed) failure = error;
        failed = true;
      });
      return work;
    },
    async drain(): Promise<void> {
      draining = true;
      while (pending.size) await Promise.allSettled([...pending]);
      if (failed) throw failure;
    },
  };
}
