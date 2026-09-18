import { assertPublicKey, KNOWN_PRODUCTION_REF, type previewSettings } from './preview-safety';

interface RequestClient {
  post(url: string, options: {
    data: Record<string, never>;
    headers: Record<string, string>;
    maxRedirects: number;
    timeout: number;
  }): Promise<{ status(): number; json(): Promise<unknown> }>;
}

type PreviewTarget = Pick<ReturnType<typeof previewSettings>, 'previewURL' | 'previewRef' | 'previewKey'>;

export async function checkPreviewCreditFunction(request: RequestClient, settings: PreviewTarget) {
  if (!/^[a-z0-9]{20}$/.test(settings.previewRef) || settings.previewRef === KNOWN_PRODUCTION_REF ||
      settings.previewURL !== `https://${settings.previewRef}.supabase.co`) {
    throw new Error('Preflight de crédito bloqueado: destino deve ser o Supabase de preview.');
  }
  assertPublicKey(settings.previewKey, settings.previewRef);
  // This exact empty body reaches the handler's CPF validation before its external fetch.
  // No caller-supplied CPF/body and no Vercel bypass header are accepted here.
  const response = await request.post(`${settings.previewURL}/functions/v1/credit-analysis`, {
    data: {}, maxRedirects: 0, timeout: 15_000,
    headers: { apikey: settings.previewKey,
      ...(settings.previewKey.startsWith('ey') ? { Authorization: `Bearer ${settings.previewKey}` } : {}) },
  });
  if (response.status() !== 400) {
    throw new Error(`Preflight credit-analysis esperava HTTP 400; recebeu ${response.status()}.`);
  }
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new Error('Preflight credit-analysis retornou JSON inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || (body as { error?: unknown }).error !== 'CPF é obrigatório') {
    throw new Error('Preflight credit-analysis retornou uma validação de CPF inesperada.');
  }
  return { function: 'credit-analysis', projectRef: settings.previewRef, status: 400,
    response: { error: 'CPF é obrigatório' }, requestBody: {},
    scope: 'Valida presença e resposta de CPF obrigatório; não comprova equivalência do código ou integração de crédito externa.' };
}
