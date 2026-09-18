import { test, expect, orderFixture } from '../support/mock';

const outcomes = [
  { status: 'APROVADO', message: null },
  { status: 'REPROVADO', message: null },
  { status: 'EM_ANALISE', message: 'Aguardando análise de crédito.' },
  { status: 'pending', message: 'Consulte o atendimento para confirmar este status.' },
] as const;

for (const outcome of outcomes) {
  test(`consulta preserva o status ${outcome.status} retornado pela API`, async ({ page }, testInfo) => {
    const order = { ...orderFixture(), status: outcome.status };
    const requests: string[] = [];
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      requests.push(route.request().method());
      expect(route.request().method()).toBe('GET');
      expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${order.order_number}`);
      await route.fulfill({ json: [order] });
    });

    await page.goto('/lookup');
    await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(order.order_number);
    await page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
    const orderGroup = page.getByRole('paragraph').filter({ hasText: /^Pedido$/ }).locator('..');
    await expect(orderGroup.getByText(order.order_number, { exact: true })).toBeVisible();
    await expect(page.getByText(outcome.status, { exact: true })).toBeVisible();
    await expect(page.getByText(order.customer_email, { exact: true })).toBeVisible();
    expect(requests).toEqual(['GET']);
    await testInfo.attach('consulta.png', {
      contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
    });

    if (outcome.message) {
      await expect(page.getByText(outcome.message, { exact: true })).toBeVisible();
    }
    for (const other of outcomes.filter((item) => item.status !== outcome.status)) {
      await expect(page.getByText(other.status, { exact: true })).toHaveCount(0);
      if (other.message) await expect(page.getByText(other.message, { exact: true })).toHaveCount(0);
    }
  });
}
