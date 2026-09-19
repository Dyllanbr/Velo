import { createPreviewOperationWindow } from '../support/preview-operation-window';
import { test, expect } from '@playwright/test';
import { isOptionalVercelToolbarRequest } from '../../src/lib/preview-safety';
import { createConfiguratorActions } from '../support/actions/configuratorActions';
import { createCheckoutActions } from '../support/actions/checkoutActions';
import { withOwnedPreviewCheckout } from '../support/preview-database';
import { RESERVED_CHECKOUT } from '../support/preview-checkout';
import { assertNoBypassReflection, checkoutPreviewSettings, createCheckoutWriteGate, validateCheckoutResponse,
  verifyCheckoutDeployment } from '../support/preview-checkout-http';
import { createRouteLifecycle, fetchProtectedApp } from '../support/protected-app-route';

const { preview } = checkoutPreviewSettings(process.env);
let firstOrder: { id: string; order_number: string } | undefined;

test.describe('compra preview: limpar antes e manter o pedido próprio', () => {
  test.describe.configure({ mode: 'serial' });
  for (const round of [1, 2]) {
    test(`rodada ${round}: compra à vista pela interface e confirmação SQL`, async ({ page, context }, testInfo) => {
      if (testInfo.retry !== 0 || testInfo.repeatEachIndex !== 0 || (round === 2 && !firstOrder)) {
        throw new Error('Run both checkout rounds together without retries; no SQL started.');
      }
      // Native async work is not automatically cancelled by a Playwright test timeout.
      // Never begin SQL cleanup or authorize a POST after page closure/the write window.
      const writeWindow = Math.min(60_000, testInfo.timeout - 60_000);
      if (!Number.isFinite(testInfo.timeout) || writeWindow <= 0) throw new Error('Checkout requires a finite test timeout with cleanup margin.');
      const window = createPreviewOperationWindow(writeWindow);
      const assertActive = window.assertActive;
      page.once('close', window.close);
      try {
        // Marker + app bundle are checked before opening a Pool or deleting fixture data.
        const deployment = await verifyCheckoutDeployment(preview, assertActive);
        const fixture = RESERVED_CHECKOUT;
        const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
          .format(fixture.totalPrice).replace(/\u00a0/g, ' ');
        const blocked: Array<{ target: string; method: string; reason: string }> = [];
        const attempts: Array<{ target: string; method: string }> = [];
        const gate = createCheckoutWriteGate(preview.previewURL, preview.baseURL);
        let acceptedPost: { id: string; order_number: string } | undefined;
        let authorizedPosts = 0;
        let forwardedPosts = 0;
        let acceptedPosts = 0;
        let networkFailed = false;
        const label = (origin: string) => origin === preview.baseURL ? 'app' : origin === preview.previewURL ? 'preview' : 'other';
        context.on('request', (request) => {
          if (request.method() === 'POST') attempts.push({ target: label(new URL(request.url()).origin), method: 'POST' });
        });

        assertActive();
        await withOwnedPreviewCheckout(process.env, deployment.marker, fixture, async (database) => {
          const routes = createRouteLifecycle(async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            try {
              assertActive();
              if (networkFailed) throw new Error('Network guard already failed; later requests remain blocked.');
              if (url.origin === preview.baseURL && request.method() === 'GET' && !url.username && !url.password) {
                const response = await fetchProtectedApp(request.url(), preview.baseURL,
                  { 'x-vercel-protection-bypass': preview.bypassSecret! }, 'GET', undefined, { assertActive });
                if (response.status >= 300 && response.status < 400) throw new Error('Application redirect blocked.');
                assertActive();
                assertNoBypassReflection(response, preview.bypassSecret!);
                delete response.headers['set-cookie'];
                delete response.headers['x-vercel-protection-bypass'];
                await route.fulfill(response);
                return;
              }
              if (url.origin === preview.previewURL) {
                const decision = gate.authorize({ url: request.url(), method: request.method(),
                  origin: request.headers().origin, preflightMethod: request.headers()['access-control-request-method'],
                  preflightHeaders: request.headers()['access-control-request-headers'], body: request.postDataBuffer() });
                // Build a header allowlist: never copy bypass/cookies or arbitrary browser authorization.
                const headers: Record<string, string> = { origin: preview.baseURL };
                if (decision.kind === 'preflight') {
                  headers['access-control-request-method'] = 'POST';
                  const requestedHeaders = request.headers()['access-control-request-headers'];
                  if (requestedHeaders) headers['access-control-request-headers'] = requestedHeaders;
                } else {
                  authorizedPosts += 1;
                  headers.apikey = preview.previewKey;
                  if (preview.previewKey.startsWith('ey')) headers.authorization = `Bearer ${preview.previewKey}`;
                  headers['content-type'] = 'application/json';
                  headers.accept = 'application/vnd.pgrst.object+json';
                  headers.prefer = 'return=representation';
                  forwardedPosts += 1;
                }
                const response = await fetchProtectedApp(request.url(), preview.previewURL, headers,
                  request.method(), decision.kind === 'post' ? request.postDataBuffer() : undefined,
                  { bypassSecret: preview.bypassSecret, assertActive });
                assertActive();
                assertNoBypassReflection(response, preview.bypassSecret!);
                if (decision.kind === 'preflight') {
                  if (![200, 204].includes(response.status)) throw new Error('Checkout preflight failed.');
                } else {
                  if (response.status !== 201) throw new Error('Checkout did not return HTTP 201; no retry.');
                  acceptedPost = validateCheckoutResponse(response.body, decision.payload);
                  acceptedPosts += 1;
                }
                delete response.headers['set-cookie'];
                delete response.headers['x-vercel-protection-bypass'];
                await route.fulfill(response);
                return;
              }
              if (isOptionalVercelToolbarRequest({ url: request.url(), method: request.method(), resourceType: request.resourceType() })
                || (request.method() === 'GET' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))) {
                await route.abort();
                return;
              }
              throw new Error('Request outside the checkout allowlist.');
            } catch {
              window.close();
              networkFailed = true;
              blocked.push({ target: label(url.origin), method: request.method(), reason: 'request-or-response-guard' });
              await route.abort().catch(() => undefined);
              throw new Error('Checkout request failed or was blocked; URL, headers, body and cause omitted.');
            }
          });
          await context.route('**/*', routes.handle);
          let bodyCompleted = false;
          let preparation: Awaited<ReturnType<typeof database.prepareCheckout>> | undefined;
          let retained: Awaited<ReturnType<typeof database.readCheckout>> | undefined;
          try {
            // Do not delete a changed second-round identity before verifying it against round one.
            if (round === 2) {
              const previous = await database.readCheckout();
              expect({ id: previous.id, order_number: previous.order_number }).toEqual(firstOrder);
            }
            assertActive();
            preparation = await database.prepareCheckout();
            if (round === 2) expect(preparation.deletedOrders).toEqual([firstOrder]);

            const configurator = createConfiguratorActions(page);
            const checkout = createCheckoutActions(page);
            await page.goto('/');
            const hero = page.getByTestId('hero-section');
            await expect(hero.getByRole('heading', { name: 'Velô Sprint', level: 1, exact: true })).toBeVisible();
            await hero.getByRole('link', { name: 'Configure Agora', exact: true }).click();
            await expect(page).toHaveURL(/\/configure$/);
            await configurator.expectPrice(price);
            await configurator.finishConfigurator();
            await checkout.expectLoaded();
            await checkout.expectConfiguration({ color: 'Glacier Blue', interior: 'carbon black', wheels: 'aero Wheels' });
            await checkout.expectNoOptionals();
            await checkout.fillCustomerData(fixture);
            await checkout.selectStore(fixture.store);
            await checkout.selectPaymentMethod(fixture.paymentMethod);
            await checkout.expectSummaryTotal(price);
            await checkout.acceptTerms();
            await checkout.submit();
            await expect(page).toHaveURL(/\/success$/);
            await expect(page.getByRole('heading', { name: 'Pedido Aprovado!', exact: true })).toBeVisible();
            if (!acceptedPost) throw new Error('No validated checkout response was captured.');
            await expect(page.getByTestId('order-id')).toHaveText(acceptedPost.order_number);
            await expect(page.getByText(`${fixture.name} ${fixture.surname}`, { exact: true })).toBeVisible();
            await expect(page.getByText(fixture.email, { exact: true })).toBeVisible();
            await expect(page.getByText(fixture.store, { exact: true })).toBeVisible();
            await expect(page.getByText(price, { exact: true })).toBeVisible();

            retained = await database.readCheckout(); // Requires exactly one full owned signature.
            expect({ id: retained.id, order_number: retained.order_number }).toEqual(acceptedPost);
            if (round === 2) {
              expect(retained.id).not.toBe(firstOrder!.id);
              expect(retained.order_number).not.toBe(firstOrder!.order_number);
            }
            await routes.drain();
            expect(blocked).toEqual([]);
            expect(attempts).toEqual([{ target: 'preview', method: 'POST' }]);
            expect({ authorizedPosts, forwardedPosts, acceptedPosts }).toEqual({ authorizedPosts: 1, forwardedPosts: 1, acceptedPosts: 1 });
            if (round === 1) firstOrder = acceptedPost;
            bodyCompleted = true;
          } finally {
            try { await routes.drain(); } finally {
              await testInfo.attach('checkout-database-evidence.json', {
                contentType: 'application/json',
                body: JSON.stringify({ round, bodyCompleted, deployment: deployment.evidence,
                  preparation, responseIdentity: acceptedPost,
                  retainedIdentity: retained && { id: retained.id, order_number: retained.order_number },
                  retainedOwnCount: retained ? 1 : undefined, attempts, authorizedPosts, forwardedPosts, acceptedPosts, blocked,
                  note: 'Only fixed preview checkout data is cleaned before the UI. Retained afterward; no production query or external credit call.' }, null, 2),
              });
            }
          }
        }, assertActive);
        await testInfo.attach('checkout-lifecycle-completed.json', {
          contentType: 'application/json',
          body: JSON.stringify({ round, databaseCallbackUnlockReleaseAndDestroyCompleted: true }),
        });
      } finally {
        window.close();
        page.off('close', window.close);
      }
    });
  }
});
