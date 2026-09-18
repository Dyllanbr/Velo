import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export const KNOWN_PRODUCTION_REF = 'zbfdffxonoztoydpdlru';
const PUBLIC_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

function required(env, name) {
  const value = env[name]?.trim();
  assert(value, `Missing ${name}. Configure it before deploying.`);
  return value;
}

export function validatePublicKey(key, projectRef, name = 'public key') {
  assert(!key.startsWith('sb_secret_'), `${name} must never be a secret key.`);
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return;
  let payload;
  try {
    assert.equal(key.split('.').length, 3);
    payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  } catch {
    throw new Error(`${name} must be a Supabase publishable key or anon JWT.`);
  }
  assert.equal(payload.role, 'anon', `${name} must have the anon role.`);
  assert.equal(payload.ref, projectRef, `${name} belongs to a different project.`);
  if (payload.exp) assert(payload.exp * 1000 > Date.now(), `${name} has expired.`);
}

export function validateConfig(env, target) {
  assert(['preview', 'production'].includes(target), 'Target must be preview or production.');
  const previewRef = required(env, 'PREVIEW_SUPABASE_PROJECT_REF');
  const productionRef = required(env, 'PRODUCTION_SUPABASE_PROJECT_REF');
  assert.match(previewRef, /^[a-z]{20}$/, 'Invalid preview project ref.');
  assert.equal(productionRef, KNOWN_PRODUCTION_REF, 'Unexpected production project ref. Review the hard-coded guard if production is intentionally replaced.');
  assert.notEqual(previewRef, productionRef, 'Preview and production must be separate Supabase projects.');
  const projectRef = target === 'preview' ? previewRef : productionRef;
  const otherRef = target === 'preview' ? productionRef : previewRef;
  const url = required(env, 'VITE_SUPABASE_URL');
  assert.equal(url.replace(/\/$/, ''), `https://${projectRef}.supabase.co`, 'Build URL does not match the expected project.');
  assert.equal(required(env, 'VITE_SUPABASE_PROJECT_ID'), projectRef, 'Build project ID does not match the expected project.');
  const key = required(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  validatePublicKey(key, projectRef, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  for (const name of Object.keys(env).filter((name) => name.startsWith('VITE_'))) {
    assert(PUBLIC_NAMES.includes(name), `Unexpected browser environment variable: ${name}. Review before exposing it.`);
  }
  const sha = required(env, 'GITHUB_SHA');
  assert.match(sha, /^[a-f0-9]{40}$/, 'Expected a complete tested Git commit SHA.');
  return { target, projectRef, otherRef, url: url.replace(/\/$/, ''), key, sha };
}

export function validateVercelProject(env, project) {
  assert.equal(project.projectId, required(env, 'VERCEL_PROJECT_ID'), 'Vercel project mismatch.');
  assert.equal(project.orgId, required(env, 'VERCEL_ORG_ID'), 'Vercel team mismatch.');
}

export function assertBundle(contents, config) {
  assert(contents.includes(config.url), 'Bundle does not contain the expected Supabase URL.');
  assert(contents.includes(config.key), 'Bundle does not contain the expected public key.');
  assert(!contents.includes(`${config.otherRef}.supabase.co`), 'Bundle contains the other environment Supabase URL.');
  assert(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(contents), 'Bundle contains a Supabase secret key.');
  const jwtCandidates = contents.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];
  for (const token of jwtCandidates) {
    let payload;
    try { payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); } catch { continue; }
    assert.notEqual(payload.role, 'service_role', 'Bundle contains a privileged JWT.');
  }
}

function readBuildFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readBuildFiles(path);
    return /\.(js|html|json|css)$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  }).join('\n');
}

function main() {
  const [command, target, directory = '.vercel/output/static'] = process.argv.slice(2);
  const config = validateConfig(process.env, target);
  if (command === 'environment') {
    required(process.env, 'VERCEL_TOKEN');
    required(process.env, 'VERCEL_PROJECT_ID');
    required(process.env, 'VERCEL_ORG_ID');
  } else if (command === 'prepare') {
    const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
    validateVercelProject(process.env, project);
    const pulled = parseEnv(readFileSync(`.vercel/.env.${target}.local`, 'utf8'));
    // Check the downloaded values separately: process.env must not hide a wrong Vercel scope.
    for (const name of PUBLIC_NAMES) assert(pulled[name] === process.env[name], `Vercel ${target} value differs for ${name}.`);
    validateConfig({ ...process.env, ...pulled }, target);
    for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
      assert(!existsSync(file), `Remove local ${file} from the CI checkout before building.`);
    }
    const marker = 'public/build-info.json';
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, JSON.stringify({ sha: config.sha, environment: target, supabaseProjectRef: config.projectRef, createdAt: new Date().toISOString() }, null, 2));
  } else if (command === 'bundle') {
    assertBundle(readBuildFiles(directory), config);
    const marker = JSON.parse(readFileSync(join(directory, 'build-info.json'), 'utf8'));
    assert.equal(marker.sha, config.sha, 'Built marker SHA mismatch.');
    assert.equal(marker.environment, target, 'Built marker environment mismatch.');
    assert.equal(marker.supabaseProjectRef, config.projectRef, 'Built marker project mismatch.');
  } else {
    throw new Error('Usage: node scripts/ci-guards.mjs environment|prepare|bundle preview|production [bundle-directory]');
  }
  console.log(`Validated ${command}: ${target}, commit ${config.sha.slice(0, 12)}. No credentials logged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(`Deployment blocked: ${error.message}`); process.exitCode = 1; }
}
