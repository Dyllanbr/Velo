import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { checkPreviewCreditFunction } from './preview-credit-preflight';
import { KNOWN_PRODUCTION_REF } from './preview-safety';

const target = { previewRef: 'abcdefghijklmnopqrst',
  previewURL: 'https://abcdefghijklmnopqrst.supabase.co', previewKey: 'sb_publishable_fixture_only' };
const expectedBody = { error: 'CPF é obrigatório' };
const client = (status = 400, body: unknown = expectedBody) => ({ post: vi.fn(async () => ({
  status: () => status, json: async () => body,
})) });

describe('preflight da função de crédito em preview', () => {
  it('envia somente corpo vazio ao preview, sem redirecionar ou enviar bypass', async () => {
    const request = client();
    await expect(checkPreviewCreditFunction(request, target)).resolves.toMatchObject({ status: 400, projectRef: target.previewRef });
    expect(request.post).toHaveBeenCalledExactlyOnceWith(`${target.previewURL}/functions/v1/credit-analysis`, {
      data: {}, maxRedirects: 0, timeout: 15_000, headers: { apikey: target.previewKey },
    });
  });
  it('preserva autenticação anon JWT sem incluir credenciais Vercel', async () => {
    const key = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'anon', ref: target.previewRef }))}.signature`;
    const request = client();
    await checkPreviewCreditFunction(request, { ...target, previewKey: key });
    expect(request.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: { apikey: key, Authorization: `Bearer ${key}` }, data: {},
    }));
  });
  it.each([200, 301, 401, 404, 502])('rejeita HTTP %i antes de considerar a função válida', async status => {
    await expect(checkPreviewCreditFunction(client(status), target)).rejects.toThrow(/HTTP 400/);
  });
  it.each([null, [], {}, { error: 'Outra mensagem' }, { error: 'CPF é obrigatório', score: 700 }])(
    'rejeita resposta diferente do contrato exato: %j', async body => {
      await expect(checkPreviewCreditFunction(client(400, body), target)).rejects.toThrow(/inesperada/);
    });
  it('rejeita JSON inválido', async () => {
    const request = { post: vi.fn(async () => ({ status: () => 400, json: async () => { throw new Error('invalid'); } })) };
    await expect(checkPreviewCreditFunction(request, target)).rejects.toThrow(/JSON inválido/);
  });
  it('bloqueia produção e URL divergente sem fazer requisição', async () => {
    const request = client();
    for (const invalid of [
      { ...target, previewRef: KNOWN_PRODUCTION_REF, previewURL: `https://${KNOWN_PRODUCTION_REF}.supabase.co` },
      { ...target, previewURL: `https://${KNOWN_PRODUCTION_REF}.supabase.co` },
      { ...target, previewURL: `${target.previewURL}/staging` },
    ]) await expect(checkPreviewCreditFunction(request, invalid)).rejects.toThrow(/bloqueado/);
    expect(request.post).not.toHaveBeenCalled();
  });
  it('o handler real retorna CPF obrigatório para {} antes de qualquer fetch externo', async () => {
    // Execute the repository handler with only Deno's serve/env replaced locally.
    // No Deno runtime, remote module download, Supabase or credit provider is contacted.
    const source = readFileSync(new URL('../../supabase/functions/credit-analysis/index.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
    let handler: (request: Request) => Promise<Response>;
    const externalFetch = vi.fn(() => { throw new Error('External fetch must not run for an empty body.'); });
    runInNewContext(compiled.outputText, {
      exports: {}, Response, fetch: externalFetch,
      Deno: { env: { get: () => undefined } },
      require: (specifier: string) => {
        if (specifier !== 'https://deno.land/std@0.168.0/http/server.ts') throw new Error('Unexpected import.');
        return { serve: (callback: typeof handler) => { handler = callback; } };
      },
    }, { timeout: 1000 });
    expect(handler).toBeTypeOf('function');
    const response = await handler(new Request('https://local.invalid/credit-analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expectedBody);
    expect(externalFetch).not.toHaveBeenCalled();
  });
});
