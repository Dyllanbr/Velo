import assert from 'node:assert/strict';
import { assertBundle, validateConfig } from './ci-guards.mjs';

// Read-only: never creates orders or writes to either database.
try {
  const [target, base] = process.argv.slice(2);
  const config = validateConfig(process.env, target);
  const origin = new URL(base);
  assert.equal(origin.protocol, 'https:', 'Deployment URL must use HTTPS.');
  assert(origin.hostname.endsWith('.vercel.app'), 'Expected a Vercel deployment URL.');
  assert.equal(origin.username + origin.password + origin.search + origin.hash, '', 'Deployment URL must not contain credentials or query parameters.');
  assert.equal(origin.pathname, '/', 'Expected the deployment origin.');
  const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : {};
  async function read(path) {
    const url = new URL(path, origin);
    assert.equal(url.origin, origin.origin, 'Only same-origin deployment assets can be read.');
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    assert(response.ok, `Deployment check failed with HTTP ${response.status}. Check Deployment Protection or build status.`);
    return response.text();
  }
  const marker = JSON.parse(await read('/build-info.json'));
  assert.equal(marker.sha, config.sha, 'Deployed commit differs from the tested commit.');
  assert.equal(marker.environment, target, 'Deployed build used the wrong environment.');
  assert.equal(marker.supabaseProjectRef, config.projectRef, 'Deployed marker points at the wrong project.');
  const html = await read('/');
  assert(html.includes('id="root"'), 'Deployment did not serve the Velo application.');
  const scripts = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map((match) => match[1]);
  assert(scripts.length > 0, 'No JavaScript bundle found.');
  const bundle = (await Promise.all(scripts.map(read))).join('\n');
  assertBundle(bundle, config);
  for (const route of ['/configure', '/lookup']) {
    assert((await read(route)).includes('id="root"'), `SPA route ${route} is not available.`);
  }
  console.log(`Read-only deployment check passed: ${target}, commit ${config.sha.slice(0, 12)}.`);
} catch (error) {
  console.error(`Deployment verification failed: ${error.message}`);
  process.exitCode = 1;
}
