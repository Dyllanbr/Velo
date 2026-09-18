import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { assertBundle, validateConfig } from './ci-guards.mjs';

const INITIAL_MARKER_WINDOW_MS = 15_000;
const INITIAL_MARKER_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

// Read-only: never creates orders or writes to either database.
export async function verifyDeployment(target, base, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
  now = () => performance.now(),
  sleep = delay,
} = {}) {
  const config = validateConfig(env, target);
  const origin = new URL(base);
  assert.equal(origin.protocol, 'https:', 'Deployment URL must use HTTPS.');
  assert(origin.hostname.endsWith('.vercel.app'), 'Expected a Vercel deployment URL.');
  assert.equal(origin.port, '', 'Deployment URL must use the default HTTPS port.');
  assert(origin.username + origin.password + origin.search + origin.hash === '', 'Deployment URL must not contain credentials or query parameters.');
  assert(origin.pathname === '/', 'Expected the deployment origin.');
  const headers = env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : {};
  const protectedValues = [env.VERCEL_AUTOMATION_BYPASS_SECRET, config.key].filter(Boolean);
  // Paths originate in deployment HTML. Never log query strings, credentials,
  // response bodies, or arbitrary response headers, including redirect targets.
  function safePath(url) {
    let path = url.pathname;
    for (const value of protectedValues) {
      path = path.replaceAll(value, '[redacted]').replaceAll(encodeURIComponent(value), '[redacted]');
    }
    return JSON.stringify(path.slice(0, 240));
  }
  function safeHeader(response, name, pattern) {
    const value = response.headers.get(name);
    if (value && protectedValues.some((secret) => value.includes(secret) || value.includes(encodeURIComponent(secret)))) return undefined;
    return value && pattern.test(value) ? `${name}=${value}` : undefined;
  }
  async function read(path, initialMarker = false) {
    const url = new URL(path, origin);
    assert(url.origin === origin.origin, 'Only same-origin deployment assets can be read.');
    assert(url.username + url.password === '', 'Asset URLs must not contain credentials.');
    const label = `GET ${safePath(url)}`;
    const deadline = initialMarker ? now() + INITIAL_MARKER_WINDOW_MS : Infinity;
    let lastResult = label;
    for (let attempt = 1; ; attempt += 1) {
      const remaining = deadline - now();
      if (remaining <= 0) {
        throw new Error(`${lastResult}. Initial marker readiness window exhausted (15000 ms maximum).`);
      }
      let response;
      try {
        // Manual mode exposes redirects without following them or forwarding
        // the bypass. Requests and pauses share one initial-marker deadline.
        response = await fetchImpl(url, { method: 'GET', headers, redirect: 'manual',
          signal: AbortSignal.timeout(Math.ceil(Math.min(30_000, remaining))) });
      } catch {
        throw new Error(`${label}: request failed or timed out; URL query, headers and cause omitted.`);
      }
      const details = [
        safeHeader(response, 'x-vercel-error', /^[A-Z][A-Z0-9_]{0,79}$/),
        safeHeader(response, 'x-vercel-id', /^[a-z0-9:;-]{1,160}$/i),
      ].filter(Boolean).join('; ');
      const result = `${label}: HTTP ${response.status}${details ? `; ${details}` : ''}`;
      lastResult = result;
      log(initialMarker ? `${result}; attempt=${attempt}/4` : result);
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => {});
        // This narrow readiness tolerance is not proof of the failure's cause.
        // Missing files, auth failures, redirects and later assets never retry.
        const missingDeployment = initialMarker && !response.redirected && response.status === 404
          && response.headers.get('x-vercel-error') === 'DEPLOYMENT_NOT_FOUND';
        const retryDelay = INITIAL_MARKER_RETRY_DELAYS_MS[attempt - 1];
        if (missingDeployment && retryDelay !== undefined && now() + retryDelay < deadline) {
          log(`${label}: DEPLOYMENT_NOT_FOUND; rechecking the initial marker in ${retryDelay} ms (15000 ms total window).`);
          await sleep(retryDelay);
          continue;
        }
        const limit = missingDeployment ? ` Initial marker readiness exhausted after ${attempt} attempt(s) (4 attempts / 15000 ms maximum).` : '';
        throw new Error(`${result}. Expected a direct successful deployment response; check this path, Deployment Protection and build output.${limit}`);
      }
      let text;
      try {
        text = await response.text();
      } catch {
        throw new Error(`${label}: response body could not be read; content and cause omitted.`);
      }
      if (now() >= deadline) {
        throw new Error(`${result}. Initial marker readiness window exhausted (15000 ms maximum).`);
      }
      return text;
    }
  }
  const markerText = await read('/build-info.json', true);
  let marker;
  try { marker = JSON.parse(markerText); } catch {
    throw new Error('GET "/build-info.json": invalid JSON; response body omitted.');
  }
  assert(marker && typeof marker === 'object' && !Array.isArray(marker), 'GET "/build-info.json": invalid marker object.');
  assert(marker.sha === config.sha, 'GET "/build-info.json": deployed commit differs from the tested commit.');
  assert(marker.environment === target, 'GET "/build-info.json": deployed build used the wrong environment.');
  assert(marker.supabaseProjectRef === config.projectRef, 'GET "/build-info.json": deployed marker points at the wrong project.');
  const html = await read('/');
  assert(html.includes('id="root"'), 'Deployment did not serve the Velo application.');
  const scripts = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map((match) => match[1]);
  assert(scripts.length > 0, 'No JavaScript bundle found.');
  const bundle = (await Promise.all(scripts.map((script) => read(script)))).join('\n');
  assertBundle(bundle, config);
  for (const route of ['/configure', '/lookup']) {
    assert((await read(route)).includes('id="root"'), `SPA route ${route} is not available.`);
  }
  log(`Read-only deployment check passed: ${target}, commit ${config.sha.slice(0, 12)}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [target, base] = process.argv.slice(2);
    await verifyDeployment(target, base);
  } catch (error) {
    console.error(`Deployment verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
