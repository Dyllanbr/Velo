import { describe, expect, it } from 'vitest';
import { assertPreviewBuild, assertPublicKey, isOptionalVercelToolbarRequest, KNOWN_PRODUCTION_REF, previewSettings } from './preview-safety';

const ref = 'abcdefghijklmnopqrst';
const publicKey = 'sb_publishable_fixture_only';
const valid = {
  E2E_PREVIEW_ALLOWED: 'true', E2E_BASE_URL: 'https://velo-preview-123.vercel.app',
  PREVIEW_SUPABASE_PROJECT_REF: ref, PREVIEW_SUPABASE_URL: `https://${ref}.supabase.co`,
  PREVIEW_SUPABASE_ANON_KEY: publicKey, GITHUB_SHA: 'a'.repeat(40),
};
const jwt = (role: string, projectRef: string) => `header.${btoa(JSON.stringify({ role, ref: projectRef }))}.signature`;

describe('supressão estrita do script opcional da Vercel', () => {
  const toolbar = { url: 'https://vercel.live/_next-live/feedback/feedback.js', method: 'GET', resourceType: 'script' };
  it('classifica somente o GET exato do script para abortar, sem autorizar tráfego', () => {
    expect(isOptionalVercelToolbarRequest(toolbar)).toBe(true);
  });
  it.each(['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'get'])('não ignora método %s', (method) => {
    expect(isOptionalVercelToolbarRequest({ ...toolbar, method })).toBe(false);
  });
  it.each(['fetch', 'xhr', 'document', 'image', 'stylesheet', 'other'])('não ignora recurso %s', (resourceType) => {
    expect(isOptionalVercelToolbarRequest({ ...toolbar, resourceType })).toBe(false);
  });
  it.each([
    `${toolbar.url}?token=fixture`, `${toolbar.url}#fragment`, `${toolbar.url}.evil`, `${toolbar.url}/`,
    'https://vercel.live/_next-live/feedback/other.js',
    'https://vercel.live.evil.invalid/_next-live/feedback/feedback.js',
    'https://sub.vercel.live/_next-live/feedback/feedback.js',
    'https://verce1.live/_next-live/feedback/feedback.js',
    'https://user:fixture@vercel.live/_next-live/feedback/feedback.js',
    'https://vercel.live@outside.invalid/_next-live/feedback/feedback.js',
    'https://vercel.live:443/_next-live/feedback/feedback.js',
    'https://vercel.live/_next-live/feedback/%66eedback.js',
    'https://%76ercel.live/_next-live/feedback/feedback.js',
    'http://vercel.live/_next-live/feedback/feedback.js',
    '//vercel.live/_next-live/feedback/feedback.js',
    'not-a-url',
  ])('não ignora URL alterada: %s', (url) => {
    expect(isOptionalVercelToolbarRequest({ ...toolbar, url })).toBe(false);
  });
});

describe('guardas fail-closed da integração real', () => {
  it('funciona sem URL ou chave de produção e expõe somente o ref para exclusão', () => {
    expect(previewSettings(valid)).toEqual({
      baseURL: valid.E2E_BASE_URL, previewRef: ref, productionRef: KNOWN_PRODUCTION_REF,
      previewURL: valid.PREVIEW_SUPABASE_URL, previewKey: publicKey,
      expectedSha: valid.GITHUB_SHA, bypassSecret: undefined,
    });
  });
  it('não lê nem propaga URL ou chave de produção eventualmente herdadas', () => {
    const environment = Object.defineProperties({ ...valid }, {
      PRODUCTION_SUPABASE_URL: { get: () => { throw new Error('Production URL must not be read.'); } },
      PRODUCTION_SUPABASE_ANON_KEY: { get: () => { throw new Error('Production key must not be read.'); } },
    });
    expect(previewSettings(environment)).toEqual(previewSettings(valid));
  });
  it('bloqueia o ref conhecido sem depender de nenhuma variável de produção', () => {
    expect(() => previewSettings({ ...valid, PREVIEW_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
      PREVIEW_SUPABASE_URL: `https://${KNOWN_PRODUCTION_REF}.supabase.co` })).toThrow(/produção/);
  });
  it.each(Object.keys(valid))('falta %s interrompe a suíte', (key) => {
    expect(() => previewSettings({ ...valid, [key]: undefined })).toThrow();
  });
  it('bloqueia a produção conhecida mesmo se alguém trocar o ref de produção declarado', () => {
    expect(() => previewSettings({ ...valid, PREVIEW_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
      PRODUCTION_SUPABASE_PROJECT_REF: ref })).toThrow(/produção/);
  });
  it('bloqueia igualdade entre projetos, incluindo outra produção', () => {
    expect(() => previewSettings({ ...valid, PRODUCTION_SUPABASE_PROJECT_REF: ref })).toThrow(/produção/);
  });
  it('não aceita uma terceira base como guard de exclusão de produção', () => {
    const otherRef = 'bbbbbbbbbbbbbbbbbbbb';
    expect(() => previewSettings({ ...valid, PRODUCTION_SUPABASE_PROJECT_REF: otherRef,
      PRODUCTION_SUPABASE_URL: `https://${otherRef}.supabase.co` })).toThrow(/produção/);
  });
  it.each([
    `https://${KNOWN_PRODUCTION_REF}.supabase.co`,
    `http://${ref}.supabase.co`, `https://${ref}.supabase.co.attacker.example`,
    `https://${ref}.supabase.co/rest/v1`, `https://user:password@${ref}.supabase.co`,
  ])('bloqueia URL preview inesperada: %s', (url) => {
    expect(() => previewSettings({ ...valid, PREVIEW_SUPABASE_URL: url })).toThrow();
  });
  it.each(['http://localhost:5173', 'https://vercel.app.attacker.example', 'https://preview.vercel.app/order'])(
    'bloqueia deployment inválido: %s', (url) => {
      expect(() => previewSettings({ ...valid, E2E_BASE_URL: url })).toThrow();
    });
  it('aceita JWT anon do ref esperado, rejeita service_role e JWT de outro projeto', () => {
    expect(() => assertPublicKey(jwt('anon', ref), ref)).not.toThrow();
    expect(() => assertPublicKey(jwt('service_role', ref), ref)).toThrow();
    expect(() => assertPublicKey(jwt('anon', KNOWN_PRODUCTION_REF), ref)).toThrow();
    expect(() => assertPublicKey('sb_secret_do_not_use', ref)).toThrow();
    expect(() => assertPublicKey('invalid', ref)).toThrow();
  });
  it('confirma SHA e destino do artefato antes de qualquer gravação', () => {
    const settings = previewSettings(valid);
    const marker = { environment: 'preview', supabaseProjectRef: ref, sha: valid.GITHUB_SHA };
    expect(() => assertPreviewBuild(marker, settings)).not.toThrow();
    expect(() => assertPreviewBuild({ ...marker, environment: 'production' }, settings)).toThrow();
    expect(() => assertPreviewBuild({ ...marker, supabaseProjectRef: KNOWN_PRODUCTION_REF }, settings)).toThrow();
    expect(() => assertPreviewBuild({ ...marker, sha: 'b'.repeat(40) }, settings)).toThrow();
    expect(() => assertPreviewBuild(null, settings)).toThrow();
  });
});
