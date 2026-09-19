import { test, expect } from '@playwright/test';
import { isOptionalVercelToolbarRequest } from '../../src/lib/preview-safety';
import { createOrderLookupActions } from '../support/actions/orderLookupActions';
import { createRouteLifecycle, fetchProtectedApp, fulfillProtectedAppRoute } from '../support/protected-app-route';
import { isAllowedPreviewOrdersRead, previewDatabaseSettings, RESERVED_ORDERS, RESERVED_ORDER_DETAILS, withOwnedPreviewDatabase } from '../support/preview-database';

const settings = previewDatabaseSettings(process.env);

// Two intentional rounds of the same three fixtures, not automatic retries.
for (const round of [1, 2]) {
  for (const scenario of RESERVED_ORDER_DETAILS) {
    test(`rodada ${round}: consulta SQL preview ${scenario.status}`, async ({ page }, testInfo) => {
      const { preview } = settings;
      const appHeaders: Record<string, string> = preview.bypassSecret
        ? { 'x-vercel-protection-bypass': preview.bypassSecret } : {};
      const response = await fetchProtectedApp(`${preview.baseURL}/build-info.json`, preview.baseURL, appHeaders);
      expect(response.status, 'Build marker must be readable before SQL writes').toBe(200);
      let marker: unknown;
      try { marker = JSON.parse(response.body.toString('utf8')); } catch {
        throw new Error('Invalid preview build marker JSON; body omitted.');
      }

      await withOwnedPreviewDatabase(process.env, marker, async (database) => {
        const blocked: Array<{ origin: string; method: string; reason: string }> = [];
        const backendOrigins = new Set<string>();
        const suppressed: string[] = [];
        const routes = createRouteLifecycle(async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const rejectRedirect = async () => {
            blocked.push({ origin: url.origin, method: request.method(), reason: 'redirect' });
          };
          if (url.origin === preview.baseURL && request.method() === 'GET') {
            return fulfillProtectedAppRoute(route, preview.baseURL, appHeaders, rejectRedirect);
          }
          if (isAllowedPreviewOrdersRead({ url: request.url(), method: request.method(),
            preflightMethod: request.headers()['access-control-request-method'] }, preview.previewURL)) {
            if (request.method() === 'GET') backendOrigins.add(url.origin);
            // No bypass header goes to Supabase, and redirects are never followed.
            const headers = { ...request.headers() };
            delete headers['x-vercel-protection-bypass'];
            delete headers.cookie;
            const backendResponse = await fetchProtectedApp(request.url(), preview.previewURL, headers, request.method());
            if (backendResponse.status >= 300 && backendResponse.status < 400) {
              await rejectRedirect();
              return route.abort('blockedbyresponse');
            }
            return route.fulfill(backendResponse);
          }
          if (isOptionalVercelToolbarRequest({ url: request.url(), method: request.method(), resourceType: request.resourceType() })) {
            suppressed.push('vercel-feedback-script');
          } else if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
            blocked.push({ origin: url.origin, method: request.method(), reason: 'outside-read-only-allowlist' });
          }
          await route.abort();
        });
        await page.route('**/*', routes.handle);
        try {
          const preparation = await database.prepare(scenario);
          if (round === 2) expect(preparation.deletedBeforeInsert).toBe(1);
          const orderLookup = createOrderLookupActions(page);
          await orderLookup.open();
          await orderLookup.searchOrder(scenario.number);
          await orderLookup.validateOrderDetails(scenario);
          await orderLookup.validateStatusBadge(scenario.number, scenario.status);
          const ownedRows = await database.readOwnedRows();
          if (scenario.status === 'EM_ANALISE') {
            expect(ownedRows, 'Each completed round retains exactly the three reserved rows').toEqual(RESERVED_ORDERS);
          }
          await routes.drain();
          await testInfo.attach('database-preview-evidence.json', {
            contentType: 'application/json',
            body: JSON.stringify({ round, scenario: scenario.status, previewRef: preview.previewRef,
              deployment: preview.baseURL, applicationSha: preview.expectedSha, preparation, ownedRows,
              network: { blocked, backendOrigins: [...backendOrigins], suppressed },
              note: 'Only reserved preview fixtures are replaced. SQL rows are retained; production is not queried.' }, null, 2),
          });
          expect(blocked).toEqual([]);
          expect([...backendOrigins]).toEqual([preview.previewURL]);
        } finally {
          await routes.drain();
        }
      });
    });
  }
}
