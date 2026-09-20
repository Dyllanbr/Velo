import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Route } from '@playwright/test';
import { createRouteLifecycle, fetchProtectedApp, fulfillProtectedAppRoute } from '../../playwright/support/protected-app-route';

const origin = 'https://velo-preview-fixture.vercel.app';
const bypass = { 'x-vercel-protection-bypass': 'fixture-only-never-log' };
afterEach(() => vi.unstubAllGlobals());

function fixture(status = 200, url = `${origin}/order`) {
  const request = { url: () => url, headers: () => ({ accept: 'text/html' }),
    method: () => 'GET', postDataBuffer: () => null } as unknown as Request;
  const response = new Response(status === 304 ? null : 'fixture body', {
    status, headers: { 'content-type': 'text/html', 'content-encoding': 'gzip', 'content-length': '1000' },
  });
  const nativeFetch = vi.fn(async () => response);
  vi.stubGlobal('fetch', nativeFetch);
  const route = {
    request: () => request,
    fetch: vi.fn(), // A secret must never reach the Playwright-instrumented API.
    fulfill: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
  const recordRedirect = vi.fn(async () => undefined);
  return { route, nativeFetch, recordRedirect,
    run: () => fulfillProtectedAppRoute(route, origin, bypass, recordRedirect) };
}

describe('headers protegidos fora da instrumentação e sem redirects', () => {
  it('busca uma vez por transporte nativo e entrega bytes sem headers de compressão obsoletos', async () => {
    const check = fixture();
    await check.run();
    expect(check.nativeFetch).toHaveBeenCalledExactlyOnceWith(new URL(`${origin}/order`), {
      method: 'GET', headers: { accept: 'text/html', ...bypass }, body: undefined,
      redirect: 'manual', signal: expect.any(AbortSignal),
    });
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.route.fulfill).toHaveBeenCalledExactlyOnceWith({
      status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('fixture body'),
    });
    expect(check.route.abort).not.toHaveBeenCalled();
    expect(check.recordRedirect).not.toHaveBeenCalled();
  });
  it.each([300, 301, 302, 303, 304, 307, 308, 399])('aborta HTTP %s antes de entregar um redirect ao navegador', async (status) => {
    const check = fixture(status);
    await check.run();
    expect(check.nativeFetch).toHaveBeenCalledOnce();
    expect(check.nativeFetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }));
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.recordRedirect).toHaveBeenCalledExactlyOnceWith(status);
    expect(check.route.abort).toHaveBeenCalledExactlyOnceWith('blockedbyresponse');
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
  it.each(['https://outside.invalid/order', 'https://velo-preview-fixture.vercel.app.evil.invalid/',
    'https://user:fixture@velo-preview-fixture.vercel.app/order'])('não envia headers a uma origem inválida: %s', async (url) => {
    const check = fixture(200, url);
    await expect(check.run()).rejects.toThrow('request headers and cause omitted');
    expect(check.nativeFetch).not.toHaveBeenCalled();
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.route.abort).toHaveBeenCalledOnce();
  });
  it('aborta e saneia falha de transporte sem divulgar headers, causa ou tentar novamente', async () => {
    const check = fixture();
    check.nativeFetch.mockRejectedValueOnce(new Error(`request header: ${bypass['x-vercel-protection-bypass']}`));
    let observed: unknown;
    try { await check.run(); } catch (error) { observed = error; }
    expect(observed).toBeInstanceOf(Error);
    expect(String(observed)).toContain('request headers and cause omitted');
    expect(String(observed)).not.toContain(bypass['x-vercel-protection-bypass']);
    expect(observed).not.toHaveProperty('cause');
    expect(check.nativeFetch).toHaveBeenCalledOnce();
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
  it('protege também o fetch direto do build-info, sem APIRequestContext', async () => {
    const check = fixture();
    check.nativeFetch.mockRejectedValueOnce(new Error(bypass['x-vercel-protection-bypass']));
    await expect(fetchProtectedApp(`${origin}/build-info.json`, origin, bypass))
      .rejects.toThrow('request headers and cause omitted');
    expect(check.nativeFetch).toHaveBeenCalledOnce();
    expect(check.route.fetch).not.toHaveBeenCalled();
  });
  it('limita o corpo da resposta antes de entregar bytes ao navegador', async () => {
    const check = fixture();
    check.nativeFetch.mockResolvedValueOnce(new Response(new Uint8Array(25 * 1024 * 1024 + 1)));
    await expect(check.run()).rejects.toThrow('request headers and cause omitted');
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
  it('ainda aborta um redirect se o registro da evidência falhar', async () => {
    const check = fixture(302);
    check.recordRedirect.mockRejectedValueOnce(new Error('Fixture evidence write failed'));
    await expect(check.run()).rejects.toThrow('Fixture evidence write failed');
    expect(check.route.abort).toHaveBeenCalledExactlyOnceWith('blockedbyresponse');
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('encerramento com handlers de rede pendentes', () => {
  it('espera a imagem já em andamento antes do teardown, sem sleeps', async () => {
    const transfer = deferred();
    const handler = vi.fn(() => transfer.promise);
    const lifecycle = createRouteLifecycle(handler);
    const work = lifecycle.handle({} as Route);
    await Promise.resolve();
    let completed = false;
    const draining = lifecycle.drain().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    transfer.resolve();
    await Promise.all([work, draining]);
    expect(completed).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });
  it('mantém o bloqueio durante o drain e aborta novas requisições', async () => {
    const transfer = deferred();
    const handler = vi.fn(() => transfer.promise);
    const lifecycle = createRouteLifecycle(handler);
    const first = lifecycle.handle({} as Route);
    await Promise.resolve();
    const draining = lifecycle.drain();
    const abort = vi.fn(async () => undefined);
    await lifecycle.handle({ abort } as unknown as Route);
    expect(abort).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    transfer.resolve();
    await Promise.all([first, draining]);
    await lifecycle.drain(); // Idempotent cleanup after the successful path.
  });
  it('não transforma erro real de handler em sucesso durante a limpeza', async () => {
    const transfer = deferred();
    const lifecycle = createRouteLifecycle(() => transfer.promise);
    const work = lifecycle.handle({} as Route);
    await Promise.resolve();
    const workFailure = expect(work).rejects.toThrow('Fixture transport failed');
    const drainFailure = expect(lifecycle.drain()).rejects.toThrow('Fixture transport failed');
    transfer.reject(new Error('Fixture transport failed'));
    await Promise.all([workFailure, drainFailure]);
    await expect(lifecycle.drain()).rejects.toThrow('Fixture transport failed');
  });
});

describe('response reflection never reaches route.fulfill', () => {
  it.each(['body', 'header', 'cookie'] as const)('rejects a successful response reflecting bypass in %s', async (location) => {
    const check = fixture();
    const secret = bypass['x-vercel-protection-bypass'];
    check.nativeFetch.mockResolvedValueOnce(new Response(location === 'body' ? secret : 'safe', {
      headers: location === 'header' ? { 'x-fixture': secret }
        : location === 'cookie' ? { 'set-cookie': `session=${secret}` } : {},
    }));
    let error: unknown;
    try { await check.run(); } catch (value) { error = value; }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secret);
    expect(error).not.toHaveProperty('cause');
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.route.fetch).not.toHaveBeenCalled();
  });

  it('checks backend reflection with an out-of-band key that is never sent to that origin', async () => {
    const check = fixture();
    const secret = bypass['x-vercel-protection-bypass'];
    check.nativeFetch.mockResolvedValueOnce(new Response(secret));
    await expect(fetchProtectedApp('https://backend.invalid/orders', 'https://backend.invalid',
      { apikey: 'public-fixture-key' }, 'GET', undefined, { bypassSecret: secret }))
      .rejects.toThrow('request headers and cause omitted');
    expect(check.nativeFetch).toHaveBeenCalledExactlyOnceWith(new URL('https://backend.invalid/orders'),
      expect.objectContaining({ headers: { apikey: 'public-fixture-key' } }));
  });

  it('does not forward cookies, browser authorization or unrelated response metadata', async () => {
    const check = fixture();
    check.route.request = () => ({ url: () => `${origin}/order`,
      headers: () => ({ accept: 'text/html', cookie: 'session=fixture', authorization: 'browser-fixture',
        'x-vercel-protection-bypass': 'browser-value-must-not-win' }),
      method: () => 'GET', postDataBuffer: () => null } as unknown as Request);
    check.nativeFetch.mockResolvedValueOnce(new Response('safe', { headers: {
      'content-type': 'text/html', 'set-cookie': 'session=fixture',
      'x-vercel-protection-bypass': 'different-private-value', 'x-private': 'omit',
      'access-control-allow-origin': origin, 'content-security-policy': "default-src 'self'",
    } }));
    await check.run();
    expect(check.nativeFetch).toHaveBeenCalledWith(expect.any(URL),
      expect.objectContaining({ headers: { accept: 'text/html', ...bypass } }));
    expect(check.route.fulfill).toHaveBeenCalledExactlyOnceWith({ status: 200, body: Buffer.from('safe'), headers: {
      'content-type': 'text/html', 'access-control-allow-origin': origin, 'content-security-policy': "default-src 'self'",
    } });
  });

  it('rechecks admission after a pending native fetch before any fulfill', async () => {
    const check = fixture();
    const delayed = deferred();
    let active = true;
    check.nativeFetch.mockImplementationOnce(async () => { await delayed.promise; return new Response('safe'); });
    const assertActive = () => { if (!active) throw new Error('closed'); };
    const work = fulfillProtectedAppRoute(check.route, origin, bypass, check.recordRedirect, { assertActive });
    const failure = expect(work).rejects.toThrow('request headers and cause omitted');
    active = false;
    delayed.resolve();
    await failure;
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
});
