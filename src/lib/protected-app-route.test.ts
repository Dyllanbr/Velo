import { describe, expect, it, vi } from 'vitest';
import type { APIResponse, Request } from '@playwright/test';
import { fulfillProtectedAppRoute } from '../../playwright/support/protected-app-route';

const origin = 'https://velo-preview-fixture.vercel.app';
const bypass = { 'x-vercel-protection-bypass': 'fixture-only-never-log' };

function fixture(status = 200, url = `${origin}/order`) {
  const request = { url: () => url, headers: () => ({ accept: 'text/html' }) } as unknown as Request;
  const response = { status: () => status, dispose: vi.fn(async () => undefined) } as unknown as APIResponse;
  const route = {
    request: () => request,
    fetch: vi.fn(async () => response),
    fulfill: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
  const recordRedirect = vi.fn(async () => undefined);
  return { route, response, recordRedirect,
    run: () => fulfillProtectedAppRoute(route, origin, bypass, recordRedirect) };
}

describe('headers protegidos sem seguir redirects', () => {
  it('obtém a resposta do próprio deployment sem redirects/retries e a entrega ao navegador', async () => {
    const check = fixture();
    await check.run();
    expect(check.route.fetch).toHaveBeenCalledExactlyOnceWith({
      headers: { accept: 'text/html', ...bypass }, maxRedirects: 0, maxRetries: 0, timeout: 30_000,
    });
    expect(check.route.fulfill).toHaveBeenCalledExactlyOnceWith({ response: check.response });
    expect(check.route.abort).not.toHaveBeenCalled();
    expect(check.recordRedirect).not.toHaveBeenCalled();
    expect(check.response.dispose).toHaveBeenCalledOnce();
  });
  it.each([300, 301, 302, 303, 304, 307, 308, 399])('aborta HTTP %s antes de entregar um redirect ao navegador', async (status) => {
    const check = fixture(status);
    await check.run();
    expect(check.route.fetch).toHaveBeenCalledOnce();
    expect(check.route.fetch).toHaveBeenCalledWith(expect.objectContaining({ maxRedirects: 0, maxRetries: 0 }));
    expect(check.recordRedirect).toHaveBeenCalledExactlyOnceWith(status);
    expect(check.route.abort).toHaveBeenCalledExactlyOnceWith('blockedbyresponse');
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.response.dispose).toHaveBeenCalledOnce();
  });
  it.each(['https://outside.invalid/order', 'https://velo-preview-fixture.vercel.app.evil.invalid/',
    'https://user:fixture@velo-preview-fixture.vercel.app/order'])('não envia headers a uma origem inválida: %s', async (url) => {
    const check = fixture(200, url);
    await expect(check.run()).rejects.toThrow('exact deployment origin');
    expect(check.route.fetch).not.toHaveBeenCalled();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
  it('aborta e saneia falha de fetch sem divulgar headers nem tentar novamente', async () => {
    const check = fixture();
    check.route.fetch.mockRejectedValueOnce(new Error(`request header: ${bypass['x-vercel-protection-bypass']}`));
    await expect(check.run()).rejects.toThrow('request headers and cause omitted');
    expect(check.route.fetch).toHaveBeenCalledOnce();
    expect(check.route.abort).toHaveBeenCalledOnce();
    expect(check.route.fulfill).not.toHaveBeenCalled();
  });
  it('ainda aborta um redirect se o registro da evidência falhar', async () => {
    const check = fixture(302);
    check.recordRedirect.mockRejectedValueOnce(new Error('Fixture evidence write failed'));
    await expect(check.run()).rejects.toThrow('Fixture evidence write failed');
    expect(check.route.abort).toHaveBeenCalledExactlyOnceWith('blockedbyresponse');
    expect(check.route.fulfill).not.toHaveBeenCalled();
    expect(check.response.dispose).toHaveBeenCalledOnce();
  });
});
