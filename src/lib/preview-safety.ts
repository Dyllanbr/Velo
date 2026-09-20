// The real integration suite must opt in explicitly and must never contact this project.
export const KNOWN_PRODUCTION_REF = 'zbfdffxonoztoydpdlru';
type Environment = Record<string, string | undefined>;

// Optional platform UI only. A matching request is aborted, never authorized
// or fetched. Do not broaden this to a domain allowlist or other methods.
export function isOptionalVercelToolbarRequest(request: {
  url: string;
  method: string;
  resourceType: string;
}): boolean {
  return request.method === 'GET' && request.resourceType === 'script'
    && request.url === 'https://vercel.live/_next-live/feedback/feedback.js';
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Integração preview bloqueada: falta ${name}.`);
  return value;
}

function projectUrl(value: string, expectedRef: string, name: string): URL {
  const url = new URL(value);
  if (!/^[a-z0-9]{20}$/.test(expectedRef) || url.protocol !== 'https:' ||
      url.hostname !== `${expectedRef}.supabase.co` || url.port || url.username ||
      url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} deve identificar exatamente o projeto Supabase declarado.`);
  }
  return url;
}

export function assertPublicKey(key: string, expectedRef: string): void {
  // Opaque publishable keys have no locally verifiable ref; URL + deployed bundle guards
  // and the server response provide that check. Never accept a secret/service_role key.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const parts = key.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) throw new Error();
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role !== 'anon' || payload.ref !== expectedRef) throw new Error();
  } catch {
    throw new Error('Somente chave pública publishable/anon do projeto esperado é permitida.');
  }
}

export function previewSettings(env: Environment) {
  if (env.E2E_PREVIEW_ALLOWED !== 'true') {
    throw new Error('Integração preview bloqueada: defina E2E_PREVIEW_ALLOWED=true explicitamente.');
  }
  const previewRef = required(env, 'PREVIEW_SUPABASE_PROJECT_REF');
  // This identity is only an exclusion guard, never an API target or credential source.
  const productionRef = KNOWN_PRODUCTION_REF;
  if (env.PRODUCTION_SUPABASE_PROJECT_REF && env.PRODUCTION_SUPABASE_PROJECT_REF !== productionRef) {
    throw new Error('O guard de exclusão deve usar o projeto de produção conhecido.');
  }
  if (previewRef === productionRef || previewRef === KNOWN_PRODUCTION_REF) {
    throw new Error('Escrita bloqueada: o projeto de preview coincide com produção.');
  }
  const previewUrl = projectUrl(required(env, 'PREVIEW_SUPABASE_URL'), previewRef, 'PREVIEW_SUPABASE_URL');
  const previewKey = required(env, 'PREVIEW_SUPABASE_ANON_KEY');
  assertPublicKey(previewKey, previewRef);
  const base = new URL(required(env, 'E2E_BASE_URL'));
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.vercel.app') ||
      base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('E2E_BASE_URL deve ser a origem HTTPS de um deployment Vercel.');
  }
  const expectedSha = env.E2E_EXPECTED_SHA || env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '')) {
    throw new Error('Informe E2E_EXPECTED_SHA ou GITHUB_SHA completo para verificar o commit do deployment.');
  }
  return {
    baseURL: base.origin, previewRef, productionRef,
    previewURL: previewUrl.origin, previewKey,
    expectedSha,
    bypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
  };
}

export function assertPreviewBuild(marker: unknown, settings: ReturnType<typeof previewSettings>) {
  const info = marker as { environment?: string; supabaseProjectRef?: string; sha?: string };
  if (info?.environment !== 'preview' || info?.supabaseProjectRef !== settings.previewRef ||
      !/^[a-f0-9]{40}$/.test(info?.sha ?? '') ||
      (settings.expectedSha && info.sha !== settings.expectedSha)) {
    throw new Error('Deployment bloqueado: build-info não confirma ambiente, projeto e commit do preview.');
  }
}
