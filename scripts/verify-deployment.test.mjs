import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_PRODUCTION_REF } from './ci-guards.mjs';
import { verifyDeployment } from './verify-deployment.mjs';

const previewRef = 'abcdefghijklmnopqrst';
const base = 'https://velo-verifier-fixture.vercel.app';
const env = {
  PREVIEW_SUPABASE_PROJECT_REF: previewRef,
  PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
  VITE_SUPABASE_URL: `https://${previewRef}.supabase.co`,
  VITE_SUPABASE_PROJECT_ID: previewRef,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_verifierfixtureonly1234567890',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-fixture-never-log',
  GITHUB_SHA: 'a'.repeat(40),
};
const marker = { sha: env.GITHUB_SHA, environment: 'preview', supabaseProjectRef: previewRef };
const html = '<div id="root"></div><script src="/assets/app.js"></script>';
const bundle = `${env.VITE_SUPABASE_URL} ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

function harness(override = () => undefined) {
  const calls = [];
  const logs = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.href, options });
    const custom = await override(url, options);
    if (custom) return custom;
    if (url.pathname === '/build-info.json') return new Response(JSON.stringify(marker));
    if (url.pathname === '/assets/app.js') return new Response(bundle);
    return new Response(html);
  };
  return { calls, logs, run: (url = base) => verifyDeployment('preview', url, {
    env, fetchImpl, log: (line) => logs.push(line),
  }) };
}

test('verifies marker, bundle and SPA routes using only same-origin GETs', async () => {
  const check = harness();
  await check.run();
  assert.deepEqual(check.calls.map(({ url }) => new URL(url).pathname), [
    '/build-info.json', '/', '/assets/app.js', '/configure', '/lookup',
  ]);
  for (const { url, options } of check.calls) {
    assert.equal(new URL(url).origin, base);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
  }
  assert(!check.logs.join('\n').includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
});

test('reports the exact failed marker, asset or SPA path without response contents', async () => {
  for (const path of ['/build-info.json', '/', '/assets/app.js', '/configure', '/lookup']) {
    const check = harness((url) => url.pathname === path ? new Response('private-response-body', {
      status: 404, headers: { 'x-vercel-error': 'NOT_FOUND', 'x-vercel-id': 'gru1::fixture-123' },
    }) : undefined);
    await assert.rejects(check.run(), (error) => {
      assert(error.message.includes(`GET ${JSON.stringify(path)}: HTTP 404`));
      assert(error.message.includes('x-vercel-error=NOT_FOUND'));
      assert(error.message.includes('x-vercel-id=gru1::fixture-123'));
      assert(!error.message.includes('private-response-body'));
      return true;
    });
    assert.equal(check.calls.filter(({ url }) => new URL(url).pathname === path).length, 1);
  }
});

test('does not follow redirects or retry authorization errors', async () => {
  for (const status of [301, 302, 303, 307, 308, 401, 403]) {
    const check = harness(() => new Response('', { status, headers: {
      location: `https://outside.invalid/?secret=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`,
    } }));
    await assert.rejects(check.run(), new RegExp(`HTTP ${status}`));
    assert.equal(check.calls.length, 1);
    assert(!check.logs.join('\n').includes('outside.invalid'));
    assert(!check.logs.join('\n').includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
  }
});

test('blocks a cross-origin asset before sending the bypass', async () => {
  const check = harness((url) => url.pathname === '/' ? new Response(
    '<div id="root"></div><script src="https://outside.invalid/app.js"></script>',
  ) : undefined);
  await assert.rejects(check.run(), /Only same-origin/);
  assert.equal(check.calls.length, 2);
});

test('rejects wrong SHA, environment or database before fetching the application', async () => {
  for (const wrong of [
    { sha: 'b'.repeat(40) }, { environment: 'production' }, { supabaseProjectRef: KNOWN_PRODUCTION_REF },
  ]) {
    const check = harness(() => new Response(JSON.stringify({ ...marker, ...wrong })));
    await assert.rejects(check.run(), /GET "\/build-info.json": deployed/);
    assert.equal(check.calls.length, 1);
  }
});

test('sanitizes invalid marker JSON, network errors, paths and diagnostic headers', async () => {
  const invalid = harness(() => new Response(`not-json ${env.VERCEL_AUTOMATION_BYPASS_SECRET}`));
  await assert.rejects(invalid.run(), (error) => error.message.includes('invalid JSON') && !error.message.includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
  const network = harness(() => { throw new Error(`url?token=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`); });
  await assert.rejects(network.run(), (error) => error.message.includes('/build-info.json') && !error.message.includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
  const path = harness((url) => url.pathname === '/' ? new Response(
    `<div id="root"></div><script src="/assets/${env.VERCEL_AUTOMATION_BYPASS_SECRET}.js?token=private-query"></script>`,
  ) : url.pathname.startsWith('/assets/') ? new Response('', {
    status: 404, headers: { 'x-vercel-error': 'untrusted header value', 'x-vercel-id': env.VERCEL_AUTOMATION_BYPASS_SECRET },
  }) : undefined);
  await assert.rejects(path.run(), /redacted/);
  const diagnostic = path.logs.join('\n');
  for (const forbidden of [env.VERCEL_AUTOMATION_BYPASS_SECRET, 'private-query', 'untrusted header value']) {
    assert(!diagnostic.includes(forbidden));
  }
});

test('still rejects a bundle containing the production URL', async () => {
  const check = harness((url) => url.pathname === '/assets/app.js' ? new Response(
    `${bundle} https://${KNOWN_PRODUCTION_REF}.supabase.co`,
  ) : undefined);
  await assert.rejects(check.run(), /other environment/);
  assert(!check.calls.some(({ url }) => new URL(url).pathname === '/configure'));
});

test('rejects unsafe deployment origins before fetching', async () => {
  for (const url of ['http://velo.vercel.app', 'https://velo.vercel.app:8443', 'https://user:password@velo.vercel.app',
    'https://outside.invalid', `${base}/?token=secret`, `${base}/path`]) {
    const check = harness();
    await assert.rejects(check.run(url), (error) => !error.message.includes('password') && !error.message.includes('token=secret'));
    assert.equal(check.calls.length, 0);
  }
});
