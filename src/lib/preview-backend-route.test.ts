import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { fulfillPreviewBackendRoute } from '../../playwright/support/preview-backend-route';
import { KNOWN_PRODUCTION_REF } from './preview-safety';

const preview = { baseURL: 'https://fixture-preview.vercel.app', previewRef: 'abcdefghijklmnopqrst',
  previewURL: 'https://abcdefghijklmnopqrst.supabase.co', previewKey: 'sb_publishable_fixture_only',
  bypassSecret: 'fake-bypass-must-not-escape' };
const production = `https://${KNOWN_PRODUCTION_REF}.supabase.co/rest/v1/orders`;
afterEach(() => vi.unstubAllGlobals());

function fixture(method = 'POST', url = `${preview.previewURL}/rest/v1/orders?select=*`) {
  const body = Buffer.from('{"customer_email":"synthetic@example.invalid"}');
  const sourceHeaders: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json',
    prefer: 'return=representation', 'x-client-info': 'supabase-fixture', cookie: 'fake-cookie',
    apikey: 'untrusted-browser-key', authorization: 'Bearer untrusted-browser-key',
    'x-vercel-protection-bypass': preview.bypassSecret };
  const route = {
    request: () => ({ url: () => url, method: () => method, headers: () => sourceHeaders,
      postDataBuffer: () => body } as unknown as Request),
    continue: vi.fn(), fetch: vi.fn(),
    fulfill: vi.fn(async () => undefined), abort: vi.fn(async () => undefined),
  };
  const fetch = vi.fn(async (_url: URL, _options?: RequestInit): Promise<Response> => new Response('[]', {
    status: 201, headers: { 'content-type': 'application/json', 'access-control-allow-origin': preview.baseURL },
  }));
  vi.stubGlobal('fetch', fetch);
  const recordRedirect = vi.fn(async (_status: number) => undefined);
  return { route, fetch, recordRedirect, sourceHeaders, body,
    run: () => fulfillPreviewBackendRoute(route, preview, recordRedirect) };
}

describe('preview backend transport without production or bypass traffic', () => {
  it('preserves the POST payload/public key and response while excluding browser credentials', async () => {
    const check = fixture();
    await check.run();
    expect(check.fetch).toHaveBeenCalledExactlyOnceWith(new URL(`${preview.previewURL}/rest/v1/orders?select=*`), {
      method: 'POST', redirect: 'manual', signal: expect.any(AbortSignal), body: new Uint8Array(check.body),
      headers: { origin: preview.baseURL, accept: 'application/json', 'content-type': 'application/json',
        prefer: 'return=representation', 'x-client-info': 'supabase-fixture', apikey: preview.previewKey },
    });
    expect(check.route.fulfill).toHaveBeenCalledExactlyOnceWith({ status: 201, body: Buffer.from('[]'),
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': preview.baseURL } });
    expect(check.route.continue).not.toHaveBeenCalled();
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.route.abort).not.toHaveBeenCalled();
  });

  it.each([302, 307, 308])('never follows a %i redirect to production or fulfills it to the browser', async (status) => {
    const check = fixture();
    const contacted: string[] = [];
    check.fetch.mockImplementation(async (url, options) => {
      contacted.push(url.origin);
      // This fake transport models the follow behavior without any real socket.
      if (url.origin === preview.previewURL && options?.redirect !== 'manual') {
        return check.fetch(new URL(production), options);
      }
      return new Response(null, { status, headers: { location: production } });
    });
    await check.run();
    expect(contacted).toEqual([preview.previewURL]);
    expect(check.recordRedirect).toHaveBeenCalledExactlyOnceWith(status);
    expect(check.route.abort).toHaveBeenCalledExactlyOnceWith('blockedbyresponse');
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.route.continue).not.toHaveBeenCalled();
    expect(check.route.fetch).not.toHaveBeenCalled();
  });

  it('uses the configured anon JWT for a GET without forwarding browser authorization or a body', async () => {
    const check = fixture('GET');
    const key = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'anon', ref: preview.previewRef }))}.signature`;
    await fulfillPreviewBackendRoute(check.route, { ...preview, previewKey: key }, check.recordRedirect);
    expect(check.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'GET', body: undefined,
      redirect: 'manual', headers: expect.objectContaining({ apikey: key, authorization: `Bearer ${key}` }) }));
    expect(check.fetch.mock.calls[0][1]?.headers).not.toHaveProperty('cookie');
    expect(check.fetch.mock.calls[0][1]?.headers).not.toHaveProperty('x-vercel-protection-bypass');
  });

  it.each([production, `${preview.previewURL}.outside.invalid/rest/v1/orders`,
    `https://user:fake@${preview.previewRef}.supabase.co/rest/v1/orders`])('rejects an invalid target before fetch: %s', async (url) => {
    const check = fixture('GET', url);
    await expect(check.run()).rejects.toThrow('content, headers and cause omitted');
    expect(check.fetch).not.toHaveBeenCalled();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });

  it('passes only the validated OPTIONS contract, without keys, cookies or bypass', async () => {
    const check = fixture('OPTIONS');
    check.sourceHeaders['access-control-request-method'] = 'POST';
    check.sourceHeaders['access-control-request-headers'] = 'apikey, authorization, content-type, content-profile, prefer';
    await check.run();
    expect(check.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'OPTIONS',
      body: undefined, redirect: 'manual', headers: { origin: preview.baseURL,
        'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey, authorization, content-type, content-profile, prefer' } }));
  });

  it.each(['GET', 'POST'])('accepts the installed Supabase SDK public profile and preflight for %s', async (method) => {
    let sdkHeaders: Record<string, string> = {};
    const client = createClient(preview.previewURL, preview.previewKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (_url, options) => {
        sdkHeaders = Object.fromEntries(new Headers(options?.headers));
        return new Response('[]', { headers: { 'content-type': 'application/json' } });
      } },
    });
    if (method === 'GET') await client.from('orders').select('*');
    else await client.from('orders').insert({ customer_email: 'synthetic@example.invalid' }).select();
    const profile = method === 'GET' ? 'accept-profile' : 'content-profile';
    expect(sdkHeaders[profile]).toBe('public');
    const preflight = fixture('OPTIONS');
    preflight.sourceHeaders['access-control-request-method'] = method;
    preflight.sourceHeaders['access-control-request-headers'] = Object.keys(sdkHeaders).join(', ');
    await preflight.run();
    expect(preflight.route.fulfill).toHaveBeenCalledOnce();
    const effective = fixture(method);
    Object.assign(effective.sourceHeaders, sdkHeaders);
    await effective.run();
    expect(effective.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      headers: expect.objectContaining({ [profile]: 'public' }), redirect: 'manual',
    }));
    expect(effective.route.fulfill).toHaveBeenCalledOnce();
  });

  it.each([['GET', 'accept-profile'], ['POST', 'content-profile']])(
    'rejects an unexpected schema in the %s %s header instead of silently replacing it', async (method, profile) => {
      const check = fixture(method);
      check.sourceHeaders[profile] = 'private_schema';
      await expect(check.run()).rejects.toThrow('content, headers and cause omitted');
      expect(check.fetch).not.toHaveBeenCalled();
      expect(check.route.fulfill).not.toHaveBeenCalled();
    });

  it('rejects an OPTIONS request for a bypass header before contacting any backend', async () => {
    const check = fixture('OPTIONS');
    check.sourceHeaders['access-control-request-method'] = 'POST';
    check.sourceHeaders['access-control-request-headers'] = 'x-vercel-protection-bypass';
    await expect(check.run()).rejects.toThrow('content, headers and cause omitted');
    expect(check.fetch).not.toHaveBeenCalled();
  });

  it.each(['body', 'header'] as const)('blocks reflected bypass in response %s without disclosing it', async (location) => {
    const check = fixture();
    check.fetch.mockResolvedValueOnce(new Response(location === 'body' ? preview.bypassSecret : 'safe', {
      headers: location === 'header' ? { 'x-fixture': preview.bypassSecret } : {},
    }));
    await expect(check.run()).rejects.toThrow(/^Preview backend request blocked; content, headers and cause omitted\.$/);
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.fetch.mock.calls[0][1]?.headers).not.toHaveProperty('x-vercel-protection-bypass');
  });

  it('sanitizes transport failures and aborts without retry or exposed cause', async () => {
    const check = fixture();
    check.fetch.mockRejectedValueOnce(new Error(preview.bypassSecret));
    let error: unknown;
    try { await check.run(); } catch (value) { error = value; }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(preview.bypassSecret);
    expect(error).not.toHaveProperty('cause');
    expect(check.fetch).toHaveBeenCalledOnce();
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
});
