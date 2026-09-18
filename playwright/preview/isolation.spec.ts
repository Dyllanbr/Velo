import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { assertPreviewBuild, isOptionalVercelToolbarRequest, previewSettings } from '../../src/lib/preview-safety';
import { checkPreviewCreditFunction } from '../../src/lib/preview-credit-preflight';
import { fillCheckout } from '../support/mock';
import { fulfillProtectedAppRoute } from '../support/protected-app-route';

const settings = previewSettings(process.env);

async function lookup(request: APIRequestContext, origin: string, key: string, column: string, value: string) {
  const url = new URL('/rest/v1/orders', origin);
  url.searchParams.set('select', 'order_number,customer_email,status');
  url.searchParams.set(column, `eq.${value}`);
  const response = await request.get(url.toString(), {
    headers: { apikey: key, ...(key.startsWith('ey') ? { Authorization: `Bearer ${key}` } : {}) },
    maxRedirects: 0,
  });
  expect(response.status(), 'A consulta somente leitura deve retornar HTTP 200').toBe(200);
  const rows = await response.json();
  expect(Array.isArray(rows)).toBe(true);
  return rows;
}

test('pedido criado no preview aparece no preview e está ausente em produção', async ({ page, request }, testInfo) => {
  const runId = randomUUID();
  const email = `e2e-preview-${runId}@example.invalid`;
  const appHeaders: Record<string, string> = settings.bypassSecret ? { 'x-vercel-protection-bypass': settings.bypassSecret } : {};
  const markerResponse = await request.get(`${settings.baseURL}/build-info.json`, {
    headers: appHeaders, maxRedirects: 0,
  });
  expect(markerResponse.status()).toBe(200);
  const marker = await markerResponse.json();
  assertPreviewBuild(marker, settings);
  const creditPreflight = await checkPreviewCreditFunction(request, settings);
  await testInfo.attach('credit-function-preflight.json', {
    contentType: 'application/json',
    body: JSON.stringify({ ...creditPreflight, checkedAt: new Date().toISOString() }, null, 2),
  });
  // Confirm production lookup works before any write. Production is accessed only by GET.
  expect(await lookup(request, settings.productionURL, settings.productionKey, 'customer_email', email)).toEqual([]);
  const blocked: string[] = [];
  const backendOrigins = new Set<string>();
  const suppressedPlatformScripts: Array<{ url: string; method: string; resourceType: string; action: string }> = [];
  const blockedAppRedirects: Array<{ origin: string; status: number; action: string }> = [];
  await page.route('**/*', async (route) => {
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
      return route.continue();
    }
    const descriptor = { url: request.url(), method: request.method(), resourceType: request.resourceType() };
    if (isOptionalVercelToolbarRequest(descriptor)) {
      suppressedPlatformScripts.push({ ...descriptor, action: 'abort' });
      return route.abort();
    }
    if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) blocked.push(url.origin);
    await route.abort();
  });
  await page.goto('/order');
  await fillCheckout(page, email);
  await page.getByTestId('checkout-submit').click();
  await expect(page.getByTestId('success-status')).toHaveText('Pedido Aprovado!');
  const orderNumber = (await page.getByTestId('order-id').innerText()).trim();
  expect(orderNumber).toMatch(/^VLO-[A-Z0-9]{6}$/);
  const previewRows = await lookup(request, settings.previewURL, settings.previewKey, 'order_number', orderNumber);
  expect(previewRows).toEqual([{ order_number: orderNumber, customer_email: email, status: 'APROVADO' }]);
  const productionRows = await lookup(request, settings.productionURL, settings.productionKey, 'order_number', orderNumber);
  expect(productionRows).toEqual([]);
  expect(await lookup(request, settings.productionURL, settings.productionKey, 'customer_email', email)).toEqual([]);
  await page.goto('/lookup');
  await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
  await expect(page.getByTestId(`order-result-${orderNumber}`)).toContainText(email);
  const browserNetwork = { blockedOrigins: blocked, backendOrigins: [...backendOrigins], suppressedPlatformScripts, blockedAppRedirects };
  await testInfo.attach('browser-network-evidence.json', {
    contentType: 'application/json', body: JSON.stringify(browserNetwork, null, 2),
  });
  expect(blocked).toEqual([]);
  expect([...backendOrigins]).toEqual([settings.previewURL]);
  await testInfo.attach('isolation-evidence.json', {
    contentType: 'application/json',
    body: JSON.stringify({ runId, sha: marker.sha, deployment: settings.baseURL,
      previewRef: settings.previewRef, productionRef: settings.productionRef,
      orderNumber, previewCount: previewRows.length, productionCount: productionRows.length,
      creditPreflight, browserNetwork,
      checkedAt: new Date().toISOString(),
      note: 'Dados sintéticos permanecem no preview como evidência; produção recebeu somente GET.' }, null, 2),
  });
});
