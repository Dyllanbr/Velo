import { createHash } from 'node:crypto';
import { assertPreviewBuild } from '../../src/lib/preview-safety';
import { previewDatabaseSettings } from './preview-database';
import { RESERVED_CHECKOUT, assertOwnedCheckoutRows } from './preview-checkout';
import { fetchProtectedApp } from './protected-app-route';
import { assertNoBypassReflection } from './protected-response';
export { assertNoBypassReflection } from './protected-response';

type Environment = Record<string, string | undefined>;
export class CheckoutHttpGuardError extends Error {}
const fail = (message: string): never => { throw new CheckoutHttpGuardError(message); };

export function checkoutPreviewSettings(env: Environment) {
  if (env.E2E_PREVIEW_CHECKOUT_ALLOWED !== 'true') fail('Checkout preview requires its separate explicit opt-in.');
  const settings = previewDatabaseSettings(env);
  if (!settings.preview.bypassSecret?.trim()) {
    fail('The protected deployment requires a configured bypass. Login/OTP is not automated by this suite.');
  }
  return settings;
}

type Preview = ReturnType<typeof checkoutPreviewSettings>['preview'];
export type CheckoutPost = {
  order_number: string; color: 'glacier-blue'; wheel_type: 'aero'; optionals: [];
  customer_name: string; customer_email: string; customer_phone: string; customer_cpf: string;
  payment_method: 'avista'; total_price: 40000; status: 'APROVADO';
};
const expectedFields = {
  color: 'glacier-blue', wheel_type: 'aero', customer_name: `${RESERVED_CHECKOUT.name} ${RESERVED_CHECKOUT.surname}`,
  customer_email: RESERVED_CHECKOUT.email, customer_phone: RESERVED_CHECKOUT.phone,
  customer_cpf: RESERVED_CHECKOUT.cpf, payment_method: 'avista', total_price: 40000, status: 'APROVADO',
};

function parsePost(body: Buffer | null): CheckoutPost {
  let value: unknown;
  try {
    if (!body || body.length > 16_384) throw new Error();
    value = JSON.parse(body.toString('utf8'));
  } catch { return fail('Checkout POST body is invalid; content omitted.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Checkout POST must be one object.');
  const row = value as Record<string, unknown>;
  const keys = [...Object.keys(expectedFields), 'order_number', 'optionals'];
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(row, key))
    || Object.entries(expectedFields).some(([key, expected]) => row[key] !== expected)
    || typeof row.order_number !== 'string' || !/^VLO-[A-Z0-9]{6}$/.test(row.order_number)
    || !Array.isArray(row.optionals) || row.optionals.length !== 0) {
    return fail('Checkout POST differs from the fixed cash reservation; values omitted.');
  }
  return row as CheckoutPost;
}

// Consume the one write permission synchronously, before any network await.
// A failed/uncertain request is never retried or rearmed by this guard.
export function createCheckoutWriteGate(previewOrigin: string, appOrigin: string) {
  let consumed = false;
  let preflightCount = 0;
  return {
    authorize(request: { url: string; method: string; origin?: string;
      preflightMethod?: string; preflightHeaders?: string; body: Buffer | null }) {
      let url: URL;
      try { url = new URL(request.url); } catch { return fail('Invalid backend target.'); }
      if (url.origin !== previewOrigin || url.username || url.password || url.hash
        || url.pathname !== '/rest/v1/orders' || [...url.searchParams.keys()].length !== 1
        || url.searchParams.get('select') !== '*' || request.origin !== appOrigin) {
        return fail('Backend request is outside the exact checkout target.');
      }
      if (request.method === 'OPTIONS') {
        const headers = (request.preflightHeaders ?? '').toLowerCase().split(',').map((part) => part.trim()).filter(Boolean);
        if (consumed || ++preflightCount > 2 || request.preflightMethod !== 'POST'
          || headers.some((name) => !['apikey', 'authorization', 'content-type', 'prefer', 'x-client-info'].includes(name))) {
          return fail('Unexpected checkout preflight.');
        }
        return { kind: 'preflight' as const };
      }
      if (request.method !== 'POST' || consumed) return fail('Only one checkout POST is allowed.');
      consumed = true;
      return { kind: 'post' as const, payload: parsePost(request.body) };
    },
  };
}

export function validateCheckoutResponse(body: Buffer, post: CheckoutPost) {
  let value: unknown;
  try { value = JSON.parse(body.toString('utf8')); } catch { return fail('Invalid checkout response JSON; content omitted.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Checkout response must be one order.');
  const row = value as Record<string, unknown>;
  if (row.order_number !== post.order_number || row.total_price !== 40000) return fail('Checkout response does not match the submitted order.');
  try {
    assertOwnedCheckoutRows([{ ...row, total_price: String(row.total_price) } as Parameters<typeof assertOwnedCheckoutRows>[0][number]]);
  } catch { return fail('Checkout response identity/signature mismatch; content omitted.'); }
  return { id: row.id as string, order_number: row.order_number as string };
}

// Native transport only: never put bypass or backend headers into Playwright API steps.
export async function verifyCheckoutDeployment(preview: Preview, assertActive?: () => void) {
  const appHeaders = { 'x-vercel-protection-bypass': preview.bypassSecret! };
  const read = async (url: string) => {
    const response = await fetchProtectedApp(url, preview.baseURL, appHeaders, 'GET', undefined, { assertActive });
    if (response.status !== 200) return fail('Preview preflight requires direct HTTP 200; no SQL started.');
    assertNoBypassReflection(response, preview.bypassSecret!);
    return response.body;
  };
  const markerBody = await read(`${preview.baseURL}/build-info.json`);
  let marker: unknown;
  try { marker = JSON.parse(markerBody.toString('utf8')); } catch { return fail('Invalid preview marker; content omitted.'); }
  assertPreviewBuild(marker, preview);
  const html = await read(`${preview.baseURL}/`);
  if (!html.toString('utf8').includes('id="root"')) return fail('Preview HTML is not the expected application.');
  const scripts = [...html.toString('utf8').matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
    .map((match) => match[1]).filter((src) => src !== 'https://vercel.live/_next-live/feedback/feedback.js');
  if (scripts.length < 1 || scripts.length > 8) return fail('Unexpected preview script inventory.');
  const urls = scripts.map((script) => {
    let url: URL;
    try { url = new URL(script, preview.baseURL); } catch { return fail('Invalid application script URL.'); }
    if (url.origin !== preview.baseURL || url.username || url.password || url.search || url.hash
      || !/^\/assets\/[A-Za-z0-9._-]+\.js$/.test(url.pathname)) return fail('Application script is outside the bounded same-origin assets.');
    return url.toString();
  });
  const bundles: Buffer[] = [];
  for (const url of urls) bundles.push(await read(url));
  const bundle = Buffer.concat(bundles).toString('utf8');
  const targets = bundle.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/g) ?? [];
  if (!bundle.includes(preview.previewURL) || !bundle.includes(preview.previewKey)
    || bundle.includes(preview.productionRef) || targets.some((url) => url !== preview.previewURL)
    || /sb_secret_[A-Za-z0-9_-]+/.test(bundle)) return fail('Preview bundle target/key guard failed; content omitted.');
  for (const token of bundle.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    let payload: { role?: string };
    try { payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { continue; }
    if (payload.role === 'service_role') return fail('Privileged credential detected in bundle; value omitted.');
  }
  return { marker, evidence: { sha: preview.expectedSha, previewRef: preview.previewRef,
    htmlSha256: createHash('sha256').update(html).digest('hex'),
    bundleSha256: createHash('sha256').update(Buffer.concat(bundles)).digest('hex'), scripts: urls.length } };
}
