import type { Route } from '@playwright/test';
import { assertPublicKey, KNOWN_PRODUCTION_REF, type previewSettings } from '../../src/lib/preview-safety';
import { fetchProtectedApp } from './protected-app-route';

type PreviewTarget = Pick<ReturnType<typeof previewSettings>,
  'baseURL' | 'previewURL' | 'previewRef' | 'previewKey' | 'bypassSecret'>;
type BackendRoute = Pick<Route, 'request' | 'fulfill' | 'abort'>;
const profileHeaders = new Set(['accept-profile', 'content-profile']);
const browserHeaders = new Set(['accept', 'content-type', 'prefer', 'x-client-info', ...profileHeaders]);
const preflightHeaders = new Set([...browserHeaders, 'apikey', 'authorization']);

export async function fulfillPreviewBackendRoute(
  route: BackendRoute,
  preview: PreviewTarget,
  recordRedirect: (status: number) => Promise<void>,
): Promise<void> {
  try {
    const request = route.request();
    const url = new URL(request.url());
    if (!/^[a-z0-9]{20}$/.test(preview.previewRef) || preview.previewRef === KNOWN_PRODUCTION_REF
      || preview.previewURL !== `https://${preview.previewRef}.supabase.co`
      || url.origin !== preview.previewURL || url.username || url.password || url.hash
      || url.pathname !== '/rest/v1/orders' || !['GET', 'POST', 'OPTIONS'].includes(request.method())) {
      throw new Error('Invalid preview backend target.');
    }
    assertPublicKey(preview.previewKey, preview.previewRef);
    const sourceHeaders = request.headers();
    const headers: Record<string, string> = { origin: preview.baseURL };
    if (request.method() === 'OPTIONS') {
      const method = sourceHeaders['access-control-request-method'];
      const names = (sourceHeaders['access-control-request-headers'] ?? '')
        .toLowerCase().split(',').map((name) => name.trim()).filter(Boolean);
      if (!['GET', 'POST'].includes(method) || names.some((name) => !preflightHeaders.has(name))) {
        throw new Error('Invalid preview backend preflight.');
      }
      headers['access-control-request-method'] = method;
      if (names.length) headers['access-control-request-headers'] = names.join(', ');
    } else {
      for (const [name, value] of Object.entries(sourceHeaders)) {
        if (profileHeaders.has(name.toLowerCase()) && value !== 'public') {
          throw new Error('Invalid preview backend schema.');
        }
        if (browserHeaders.has(name.toLowerCase())) headers[name.toLowerCase()] = value;
      }
      // Use only the configured public preview key, never browser credentials or bypass.
      headers.apikey = preview.previewKey;
      if (preview.previewKey.startsWith('ey')) headers.authorization = `Bearer ${preview.previewKey}`;
    }
    const response = await fetchProtectedApp(request.url(), preview.previewURL, headers,
      request.method(), request.method() === 'POST' ? request.postDataBuffer() : undefined,
      { bypassSecret: preview.bypassSecret });
    if (response.status >= 300 && response.status < 400) {
      await recordRedirect(response.status);
      await route.abort('blockedbyresponse');
      return;
    }
    await route.fulfill(response);
  } catch {
    await route.abort('blockedbyresponse').catch(() => undefined);
    throw new Error('Preview backend request blocked; content, headers and cause omitted.');
  }
}
