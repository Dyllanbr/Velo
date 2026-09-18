import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBundle, KNOWN_PRODUCTION_REF, validateConfig, validatePublicKey, validateVercelProject } from './ci-guards.mjs';

const previewRef = 'abcdefghijklmnopqrst';
const anon = (ref, role = 'anon') => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ ref, role })).toString('base64url')}.signature`;
const env = {
  PREVIEW_SUPABASE_PROJECT_REF: previewRef,
  PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
  VITE_SUPABASE_URL: `https://${previewRef}.supabase.co`,
  VITE_SUPABASE_PROJECT_ID: previewRef,
  VITE_SUPABASE_PUBLISHABLE_KEY: anon(previewRef),
  GITHUB_SHA: 'a'.repeat(40),
};

test('accepts an explicit isolated preview configuration', () => {
  assert.equal(validateConfig(env, 'preview').projectRef, previewRef);
});
test('blocks the known production project as preview, even if variables are swapped', () => {
  assert.throws(() => validateConfig({ ...env, PREVIEW_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF }, 'preview'));
  assert.throws(() => validateConfig({ ...env, PRODUCTION_SUPABASE_PROJECT_REF: previewRef }, 'preview'));
});
test('blocks URL/ref mismatch and privileged browser credentials', () => {
  assert.throws(() => validateConfig({ ...env, VITE_SUPABASE_URL: `https://${KNOWN_PRODUCTION_REF}.supabase.co` }, 'preview'));
  for (const key of [anon(previewRef, 'service_role'), 'sb_secret_12345678901234567890', anon(KNOWN_PRODUCTION_REF)]) {
    assert.throws(() => validatePublicKey(key, previewRef));
  }
});
test('accepts public publishable keys and blocks missing or unexpected exposed variables', () => {
  validatePublicKey('sb_publishable_12345678901234567890', previewRef);
  assert.throws(() => validateConfig({ ...env, VITE_DATABASE_PASSWORD: 'not-for-browsers' }, 'preview'));
  assert.throws(() => validateConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: '' }, 'preview'));
});
test('checks the actual artifact, including the opposite database URL', () => {
  const config = validateConfig(env, 'preview');
  const correct = `${config.url} ${config.key}`;
  assertBundle(correct, config);
  assert.throws(() => assertBundle(`${correct} https://${KNOWN_PRODUCTION_REF}.supabase.co`, config));
  assert.throws(() => assertBundle('empty build', config));
  assert.throws(() => assertBundle(`${correct} sb_secret_12345678901234567890`, config));
});
test('refuses linking/deploying another Vercel project or team', () => {
  const ids = { VERCEL_PROJECT_ID: 'prj_expected', VERCEL_ORG_ID: 'team_expected' };
  validateVercelProject(ids, { projectId: 'prj_expected', orgId: 'team_expected' });
  assert.throws(() => validateVercelProject(ids, { projectId: 'prj_other', orgId: 'team_expected' }));
});
