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
const toolbar = 'https://vercel.live/_next-live/feedback/feedback.js';

function harness(override = () => undefined) {
  const calls = [];
  const logs = [];
  const waits = [];
  let elapsed = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.href, options });
    const custom = await override(url, options);
    if (custom) return custom;
    if (url.pathname === '/build-info.json') return new Response(JSON.stringify(marker));
    if (url.pathname === '/assets/app.js') return new Response(bundle);
    return new Response(html);
  };
  return { calls, logs, waits, advance: (ms) => { elapsed += ms; }, run: (url = base) => verifyDeployment('preview', url, {
    env, fetchImpl, log: (line) => logs.push(line), now: () => elapsed,
    sleep: async (ms) => { waits.push(ms); elapsed += ms; },
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
      'x-vercel-error': 'DEPLOYMENT_NOT_FOUND',
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

test('ignores only the exact Vercel Toolbar source and still validates the application bundle', async () => {
  const check = harness((url) => url.pathname === '/' ? new Response(
    `<div id="root"></div><script type="module" src="/assets/app.js"></script><script src="${toolbar}"></script>`,
  ) : undefined);
  await check.run();
  assert.deepEqual(check.calls.map(({ url }) => new URL(url).pathname), [
    '/build-info.json', '/', '/assets/app.js', '/configure', '/lookup',
  ]);
  assert(check.calls.every(({ url }) => new URL(url).origin === base));
  assert(check.logs.some((line) => line.includes('Ignored the exact Vercel Toolbar script')));
  assert(!check.logs.join('\n').includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));

  const wrongBundle = harness((url) => url.pathname === '/' ? new Response(
    `${html}<script src="${toolbar}"></script>`,
  ) : url.pathname === '/assets/app.js' ? new Response(
    `${bundle} https://${KNOWN_PRODUCTION_REF}.supabase.co`,
  ) : undefined);
  await assert.rejects(wrongBundle.run(), /other environment/);
  assert(!wrongBundle.calls.some(({ url }) => new URL(url).pathname === '/configure'));
});

test('the toolbar alone cannot satisfy the requirement for an application bundle', async () => {
  for (const scripts of ['', `<script src="${toolbar}"></script>`]) {
    const check = harness((url) => url.pathname === '/' ? new Response(`<div id="root"></div>${scripts}`) : undefined);
    await assert.rejects(check.run(), /No same-origin application JavaScript bundle/);
    assert.equal(check.calls.length, 2);
  }
});

test('rejects toolbar lookalikes, altered paths, queries and credentials before any bundle request', async () => {
  const path = '/_next-live/feedback/feedback.js';
  for (const script of [
    `https://vercel.live.evil.invalid${path}`, `https://sub.vercel.live${path}`, `https://vercel-live.invalid${path}`,
    `https://verce1.live${path}`, `https://vercel.live.${path}`, `https://%76ercel.live${path}`,
    `http://vercel.live${path}`, `//vercel.live${path}`, `https://vercel.live:443${path}`,
    `https://vercel.live:8443${path}`, `https://VERCEL.LIVE${path}`, `${toolbar}.evil`, `${toolbar}/`,
    'https://vercel.live/_next-live/feedback/other.js', 'https://vercel.live/_next-live/feedback/%66eedback.js',
    'https://vercel.live/_next-live/other/../feedback/feedback.js',
    `${toolbar}?token=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`, `${toolbar}#fragment`,
    `https://user:${env.VERCEL_AUTOMATION_BYPASS_SECRET}@vercel.live${path}`,
    `https://vercel.live@outside.invalid${path}`, `https://vercel.live\\@outside.invalid${path}`,
  ]) {
    // Include a valid bundle first: all sources must be classified before its
    // request starts, so an unknown external script cannot race bundle reads.
    const check = harness((url) => url.pathname === '/' ? new Response(
      `${html}<script src="${script}"></script>`,
    ) : undefined);
    await assert.rejects(check.run(), (error) => {
      assert.match(error.message, /Only same-origin|Invalid deployment script URL/);
      assert(!error.message.includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
      return true;
    });
    assert.equal(check.calls.length, 2);
    assert(check.calls.every(({ url }) => new URL(url).origin === base));
    assert(!check.logs.join('\n').includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
  }
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
  assert.equal(network.calls.length, 1);
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

function missingDeployment(status = 404, code = 'DEPLOYMENT_NOT_FOUND') {
  return new Response('private-platform-body', { status, headers: {
    'x-vercel-error': code, 'x-vercel-id': 'cle1::fixture-123',
  } });
}

test('rechecks only initial deployment-not-found responses before validating the entire application', async () => {
  let missing = 2;
  const check = harness((url) => url.pathname === '/build-info.json' && missing-- > 0 ? missingDeployment() : undefined);
  await check.run();
  assert.deepEqual(check.waits, [1_000, 2_000]);
  assert.deepEqual(check.calls.map(({ url }) => new URL(url).pathname), [
    '/build-info.json', '/build-info.json', '/build-info.json', '/', '/assets/app.js', '/configure', '/lookup',
  ]);
  assert.equal(check.logs.filter((line) => line.includes('HTTP 404; x-vercel-error=DEPLOYMENT_NOT_FOUND')).length, 2);
  assert(check.logs.some((line) => line.includes('HTTP 200; attempt=3/4')));
  for (const { options } of check.calls) {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
  }
  assert(!check.logs.join('\n').includes('private-platform-body'));
  assert(!check.logs.join('\n').includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
});

test('fails closed after four initial-marker attempts and preserves every HTTP diagnostic', async () => {
  const check = harness(() => missingDeployment());
  await assert.rejects(check.run(), /HTTP 404; x-vercel-error=DEPLOYMENT_NOT_FOUND.*readiness exhausted after 4 attempt/);
  assert.equal(check.calls.length, 4);
  assert.deepEqual(check.waits, [1_000, 2_000, 4_000]);
  assert.equal(check.logs.filter((line) => line.includes('HTTP 404;')).length, 4);
  assert(check.calls.every(({ url }) => new URL(url).pathname === '/build-info.json'));
});

test('request time consumes the shared readiness budget instead of resetting it per attempt', async () => {
  const check = harness(() => {
    check.advance(8_000);
    return missingDeployment();
  });
  await assert.rejects(check.run(), /HTTP 404.*readiness exhausted after 2 attempt/);
  assert.equal(check.calls.length, 2);
  assert.deepEqual(check.waits, [1_000]);
  // A slow success must not extend the deadline either. Real fetch/body reads
  // receive an AbortSignal for the remaining budget; the mock advances time.
  const slow = harness(() => {
    const response = new Response(JSON.stringify(marker));
    response.text = async () => { slow.advance(15_000); return JSON.stringify(marker); };
    return response;
  });
  await assert.rejects(slow.run(), /readiness window exhausted/);
  assert.equal(slow.calls.length, 1);
  assert.deepEqual(slow.waits, []);
});

test('does not retry other status/header combinations or already-followed responses', async () => {
  for (const [status, code, redirected] of [
    [404, '', false], [404, 'NOT_FOUND', false], [404, 'deployment_not_found', false],
    [500, 'DEPLOYMENT_NOT_FOUND', false], [404, 'DEPLOYMENT_NOT_FOUND', true],
  ]) {
    const check = harness(() => {
      const response = missingDeployment(status, code);
      Object.defineProperty(response, 'redirected', { value: redirected });
      return response;
    });
    await assert.rejects(check.run(), new RegExp(`HTTP ${status}`));
    assert.equal(check.calls.length, 1);
    assert.deepEqual(check.waits, []);
  }
});

test('deployment-not-found on an asset or SPA route never receives readiness retries', async () => {
  for (const path of ['/', '/assets/app.js', '/configure', '/lookup']) {
    const check = harness((url) => url.pathname === path ? missingDeployment() : undefined);
    await assert.rejects(check.run(), /HTTP 404; x-vercel-error=DEPLOYMENT_NOT_FOUND/);
    assert.equal(check.calls.filter(({ url }) => new URL(url).pathname === path).length, 1);
    assert.deepEqual(check.waits, []);
  }
});

test('a recovered marker still rejects invalid JSON, SHA, environment and database without further retries', async () => {
  for (const body of ['not-json', ...[
    { sha: 'b'.repeat(40) }, { environment: 'production' }, { supabaseProjectRef: KNOWN_PRODUCTION_REF },
  ].map((wrong) => JSON.stringify({ ...marker, ...wrong }))]) {
    let initial = true;
    const check = harness(() => {
      if (initial) { initial = false; return missingDeployment(); }
      return new Response(body);
    });
    await assert.rejects(check.run(), /invalid JSON|deployed/);
    assert.equal(check.calls.length, 2);
    assert.deepEqual(check.waits, [1_000]);
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
