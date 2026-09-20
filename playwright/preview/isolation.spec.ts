import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { assertPreviewBuild, isOptionalVercelToolbarRequest, previewSettings } from '../../src/lib/preview-safety';
import { checkPreviewCreditFunction } from '../../src/lib/preview-credit-preflight';
import { fillCheckout } from '../support/mock';
import { createRouteLifecycle, fetchProtectedApp, fulfillProtectedAppRoute } from '../support/protected-app-route';
import { fulfillPreviewBackendRoute } from '../support/preview-backend-route';

const settings = previewSettings(process.env);

async function lookupPreview(request: APIRequestContext, orderNumber: string) {
  const url = new URL('/rest/v1/orders', settings.previewURL);
  const key = settings.previewKey;
  url.searchParams.set('select', 'order_number,customer_email,status');
  url.searchParams.set('order_number', `eq.${orderNumber}`);
  const response = await request.get(url.toString(), {
    headers: { apikey: key, ...(key.startsWith('ey') ? { Authorization: `Bearer ${key}` } : {}) },
    maxRedirects: 0,
  });
  expect(response.status(), 'A consulta somente leitura deve retornar HTTP 200').toBe(200);
  const rows = await response.json();
  expect(Array.isArray(rows)).toBe(true);
  return rows;
}

test('pedido criado e consultado somente no preview sem contatar produção', async ({ page, request }, testInfo) => {
  const runId = randomUUID();
  const email = `e2e-preview-${runId}@example.invalid`;
  const appHeaders: Record<string, string> = settings.bypassSecret ? { 'x-vercel-protection-bypass': settings.bypassSecret } : {};
  const markerResponse = await fetchProtectedApp(`${settings.baseURL}/build-info.json`, settings.baseURL, appHeaders);
  expect(markerResponse.status).toBe(200);
  let marker: unknown;
  try { marker = JSON.parse(markerResponse.body.toString('utf8')); } catch {
    throw new Error('Invalid protected build marker JSON; response body omitted.');
  }
  assertPreviewBuild(marker, settings);
  const creditPreflight = await checkPreviewCreditFunction(request, settings);
  await testInfo.attach('credit-function-preflight.json', {
    contentType: 'application/json',
    body: JSON.stringify({ ...creditPreflight, checkedAt: new Date().toISOString() }, null, 2),
  });
  const blocked: string[] = [];
  const backendOrigins = new Set<string>();
  const suppressedPlatformScripts: Array<{ url: string; method: string; resourceType: string; action: string }> = [];
  const blockedAppRedirects: Array<{ origin: string; status: number; action: string }> = [];
  const blockedBackendRedirects: Array<{ origin: string; status: number; action: string }> = [];
  const routes = createRouteLifecycle(async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === settings.baseURL) {
      return fulfillProtectedAppRoute(route, settings.baseURL, appHeaders, async (status) => {
        blocked.push(url.origin);
        const evidence = { origin: url.origin, status, action: 'abort' };
        blockedAppRedirects.push(evidence);
        await testInfo.attach('blocked-app-redirect.json', {
          contentType: 'application/json', body: JSON.stringify(evidence, null, 2),
        });
      });
    }
    if (url.origin === settings.previewURL) {
      backendOrigins.add(url.origin);
      return fulfillPreviewBackendRoute(route, settings, async (status) => {
        blocked.push(url.origin);
        blockedBackendRedirects.push({ origin: url.origin, status, action: 'abort' });
      });
    }
    const descriptor = { url: request.url(), method: request.method(), resourceType: request.resourceType() };
    if (isOptionalVercelToolbarRequest(descriptor)) {
      suppressedPlatformScripts.push({ ...descriptor, action: 'abort' });
      return route.abort();
    }
    if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) blocked.push(url.origin);
    await route.abort();
  });
  await page.route('**/*', routes.handle);
  try {
    await page.goto('/order');
    await fillCheckout(page, email);
    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('success-status')).toHaveText('Pedido Aprovado!');
    const orderNumber = (await page.getByTestId('order-id').innerText()).trim();
    expect(orderNumber).toMatch(/^VLO-[A-Z0-9]{6}$/);
    const previewRows = await lookupPreview(request, orderNumber);
    expect(previewRows).toEqual([{ order_number: orderNumber, customer_email: email, status: 'APROVADO' }]);
    await page.goto('/lookup');
    await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(orderNumber);
    await page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
    await expect(page.getByTestId(`order-result-${orderNumber}`)).toContainText(email);
    await routes.drain();
    const browserNetwork = { blockedOrigins: blocked, backendOrigins: [...backendOrigins], suppressedPlatformScripts,
      blockedAppRedirects, blockedBackendRedirects };
    await testInfo.attach('browser-network-evidence.json', {
      contentType: 'application/json', body: JSON.stringify(browserNetwork, null, 2),
    });
    expect(blocked).toEqual([]);
    expect([...backendOrigins]).toEqual([settings.previewURL]);
    await testInfo.attach('isolation-evidence.json', {
      contentType: 'application/json',
      body: JSON.stringify({ runId, sha: settings.expectedSha, deployment: settings.baseURL,
        previewRef: settings.previewRef, productionRef: settings.productionRef,
        orderNumber, previewCount: previewRows.length, productionNotContacted: true,
        productionAbsenceVerification: 'external_audit_required',
        creditPreflight, browserNetwork,
        checkedAt: new Date().toISOString(),
        note: 'Dados sintéticos permanecem no preview; este cenário não contata produção. A ausência em produção exige auditoria externa.' }, null, 2),
    });
  } finally {
    await routes.drain();
  }
});
