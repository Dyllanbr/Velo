import { test, expect, orderFixture, fillCheckout } from '../support/mock';

const outcomes = [
  { score: 800, status: 'APROVADO', heading: 'Pedido Aprovado!',
    message: 'Seu pedido foi processado com sucesso. Em breve entraremos em contato.' },
  { score: 400, status: 'REPROVADO', heading: 'Crédito Reprovado',
    message: 'Infelizmente seu crédito não foi aprovado. Tente novamente com pagamento à vista.' },
  { score: 600, status: 'EM_ANALISE', heading: 'Crédito em análise',
    message: 'Seu pedido foi registrado e aguarda análise de crédito.' },
] as const;

for (const outcome of outcomes) {
  test(`financiamento com entrada zero apresenta ${outcome.status} sem confundir a decisão`, async ({ page }, testInfo) => {
    const fixture = orderFixture();
    const creditRequests: unknown[] = [];
    const orders: Record<string, unknown>[] = [];

    await page.route('https://velo-e2e.invalid/functions/v1/credit-analysis', async (route) => {
      expect(route.request().method()).toBe('POST');
      const body = route.request().postDataJSON();
      expect(body).toEqual({ cpf: fixture.customer_cpf });
      creditRequests.push(body);
      await route.fulfill({ json: { status: 'Done', score: outcome.score } });
    });
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      expect(route.request().method()).toBe('POST');
      const payload = route.request().postDataJSON();
      orders.push(payload);
      // Echo the actual application payload, adding only database-generated metadata.
      // In particular, the mock must not inject the expected status into the response.
      await route.fulfill({ status: 201, json: {
        ...payload, id: fixture.id, created_at: fixture.created_at, updated_at: fixture.updated_at,
      } });
    });

    await page.goto('/order');
    await fillCheckout(page, fixture.customer_email);
    await expect(page.getByTestId('summary-total-price')).toHaveText('R$ 40.000,00');
    await page.getByTestId('payment-financiamento').click();
    await page.getByRole('spinbutton', { name: 'Valor da Entrada', exact: true }).fill('0');
    // Characterizes the zero-entry example shown in the course; not a general interest-rule approval.
    await expect(page.getByTestId('summary-total-price')).toHaveText('R$ 40.800,00');
    const summaryTotalBeforeSubmit = await page.getByTestId('summary-total-price').innerText();
    await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

    await expect(page).toHaveURL(/\/success$/);
    await expect(page.getByTestId('success-status')).toBeVisible();
    expect(creditRequests).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      status: outcome.status, payment_method: 'financiamento', customer_email: fixture.customer_email,
      customer_cpf: fixture.customer_cpf, total_price: 40_800,
    });
    await testInfo.attach('credit-decision-and-ui.json', {
      contentType: 'application/json',
      body: JSON.stringify({ creditRequests, mockedScore: outcome.score, submittedOrder: orders[0],
        summaryTotalBeforeSubmit, expectedZeroEntryTotal: 40_800,
        headingObserved: await page.getByTestId('success-status').innerText(),
        expectedHeading: outcome.heading, scope: 'Local UI and application logic; all APIs mocked.' }, null, 2),
    });
    await testInfo.attach('confirmation.png', {
      contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
    });

    await expect(page.getByTestId('success-status')).toHaveText(outcome.heading);
    await expect(page.getByText(outcome.message, { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-id')).toHaveText(String(orders[0].order_number));
    if (outcome.status !== 'REPROVADO') {
      await expect(page.getByText('Crédito Reprovado', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Infelizmente seu crédito não foi aprovado.', { exact: false })).toHaveCount(0);
    }
  });
}
