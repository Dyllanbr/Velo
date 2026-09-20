import { expect, type Page } from '@playwright/test';

export async function mockCreditAnalysis(page: Page, score: number, expectedCpf: string) {
  const endpoint = 'https://velo-e2e.invalid/functions/v1/credit-analysis';
  const requests: unknown[] = [];
  await page.route(endpoint, async (route) => {
    expect(route.request().url()).toBe(endpoint);
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON();
    expect(body).toEqual({ cpf: expectedCpf });
    requests.push(body);
    expect(requests, 'A análise de crédito deve ser solicitada uma única vez').toHaveLength(1);
    await route.fulfill({ status: 200, json: { status: 'Done', score } });
  });
  return { endpoint, requests: requests as readonly unknown[] };
}
