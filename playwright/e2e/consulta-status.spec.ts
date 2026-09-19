import { test, expect } from '../support/fixtures';
import { orderFixture } from '../support/mock';
import { type OrderDetails } from '../support/actions/orderLookupActions';

test.beforeEach(async ({ app }) => {
  await app.orderLookup.open();
});

const outcomes = [
  { status: 'APROVADO', message: null },
  { status: 'REPROVADO', message: null },
  { status: 'EM_ANALISE', message: 'Aguardando análise de crédito.' },
  { status: 'pending', message: 'Consulte o atendimento para confirmar este status.' },
] as const;

for (const outcome of outcomes.filter((item) => item.status !== 'REPROVADO')) {
  test(`consulta preserva o status ${outcome.status} retornado pela API`, async ({ page, app }, testInfo) => {
    const order = { ...orderFixture(), status: outcome.status };
    const requests: string[] = [];
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      requests.push(route.request().method());
      expect(route.request().method()).toBe('GET');
      expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${order.order_number}`);
      await route.fulfill({ json: [order] });
    });

    await app.orderLookup.searchOrder(order.order_number);
    const orderGroup = page.getByRole('paragraph').filter({ hasText: /^Pedido$/ }).locator('..');
    await expect(orderGroup.getByText(order.order_number, { exact: true })).toBeVisible();
    await expect(page.getByText(outcome.status, { exact: true })).toBeVisible();
    await expect(page.getByText(order.customer_email, { exact: true })).toBeVisible();
    expect(requests).toEqual(['GET']);

    await app.orderLookup.validateStatusBadge(order.order_number, outcome.status);

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

test('consulta preserva o status REPROVADO retornado pela API', async ({ page, app }, testInfo) => {
  const order = {
    ...orderFixture(),
    status: 'REPROVADO' as const,
    color: 'midnight-black',
    wheel_type: 'sport',
    optionals: ['precision-park', 'flux-capacitor'],
    customer_name: 'Cliente Reprovado',
    payment_method: 'avista',
    total_price: 52500,
  };
  const expected: OrderDetails = {
    number: order.order_number,
    status: order.status,
    color: 'Midnight Black',
    wheels: 'sport Wheels',
    customer: { name: order.customer_name, email: order.customer_email },
    payment: 'À Vista',
    price: 'R$ 52.500,00',
  };
  const requests: string[] = [];
  await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
    requests.push(route.request().method());
    expect(route.request().method()).toBe('GET');
    expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${order.order_number}`);
    await route.fulfill({ json: [order] });
  });

  await app.orderLookup.searchOrder(order.order_number);
  const orderGroup = page.getByRole('paragraph').filter({ hasText: /^Pedido$/ }).locator('..');
  await expect(orderGroup.getByText(order.order_number, { exact: true })).toBeVisible();
  await expect(page.getByText(order.status, { exact: true })).toBeVisible();
  await expect(page.getByText(order.customer_email, { exact: true })).toBeVisible();
  expect(requests).toEqual(['GET']);

  await app.orderLookup.validateStatusBadge(order.order_number, order.status);

  await app.orderLookup.validateOrderDetails(expected);
  for (const other of outcomes.filter((item) => item.status !== 'REPROVADO')) {
    await expect(page.getByText(other.status, { exact: true })).toHaveCount(0);
    if (other.message) await expect(page.getByText(other.message, { exact: true })).toHaveCount(0);
  }
  await testInfo.attach('consulta.png', {
    contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
  });
});
