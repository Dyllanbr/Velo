import { test, expect } from '../support/fixtures';
import { orderFixture, fillCheckout } from '../support/mock';
import { type OrderDetails } from '../support/actions/orderLookupActions';

test.describe('Consulta de pedidos', () => {
  test.beforeEach(async ({ app }) => {
    await app.orderLookup.open();
  });

  test('consulta normaliza número e exibe pedido aprovado criado pelo próprio teste', async ({ page, app }) => {
    const order = orderFixture();
    const expected: OrderDetails = {
      number: order.order_number,
      status: 'APROVADO',
      color: 'Glacier Blue',
      wheels: 'aero Wheels',
      customer: { name: order.customer_name, email: order.customer_email },
      payment: 'À Vista',
      price: 'R$ 40.000,00',
    };
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      expect(route.request().method()).toBe('GET');
      expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${order.order_number}`);
      await route.fulfill({ json: [order] });
    });
    await app.orderLookup.searchOrder(`  ${order.order_number.toLowerCase()}  `);
    const orderGroup = page.getByRole('paragraph')
      .filter({ hasText: /^Pedido$/ })
      .locator('..');
    await expect(orderGroup.getByText(order.order_number, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('APROVADO', { exact: true })).toBeVisible();
    await expect(page.getByText(order.customer_email, { exact: true })).toBeVisible();

    await app.orderLookup.validateOrderDetails(expected);
  });

  test('consulta informa quando não há pedido', async ({ page, app }) => {
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', (route) => route.fulfill({ json: [] }));
    await app.orderLookup.searchOrder(orderFixture().order_number);
    await app.orderLookup.validateOrderNotFound();
  });

  test('consulta informa quando o código está fora do padrão', async ({ page, app }) => {
    const orderCode = 'XYZ-999-INVALIDO';
    const requests: string[] = [];
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      requests.push(route.request().method());
      expect(route.request().method()).toBe('GET');
      expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${orderCode}`);
      await route.fulfill({ json: [] });
    });
    await app.orderLookup.searchOrder(`  ${orderCode.toLowerCase()}  `);
    await app.orderLookup.validateOrderNotFound();
    expect(requests).toEqual(['GET']);
  });
});

test('checkout incompleto não envia pedido', async ({ page }) => {
  await page.goto('/order');
  await page.getByTestId('checkout-submit').click();
  await expect(page.getByText('Nome deve ter pelo menos 2 caracteres', { exact: true })).toBeVisible();
  await expect(page.getByText('Aceite os termos', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/order$/);
});

for (const field of [
  { id: 'checkout-cpf', value: '0000000000', error: 'CPF inválido' },
  { id: 'checkout-phone', value: '1199999000', error: 'Telefone inválido' },
]) {
  test(`checkout recusa máscara incompleta: ${field.error}`, async ({ page }) => {
    const fixture = orderFixture();
    const submissions: string[] = [];
    await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
      submissions.push(route.request().method());
      await route.fulfill({ status: 201, json: fixture });
    });
    await page.goto('/order');
    await fillCheckout(page, fixture.customer_email);
    await page.getByTestId(field.id).fill(field.value);
    await expect(page.getByTestId(field.id)).toHaveValue(/_/);

    await page.getByTestId('checkout-submit').click();

    await expect(page.getByText(field.error, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/order$/);
    expect(submissions, 'Dados incompletos não devem chegar à API').toEqual([]);
  });
}

test('checkout à vista envia configuração e apresenta o número retornado', async ({ page }) => {
  const fixture = orderFixture();
  let inserted = false;
  await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
    expect(route.request().method()).toBe('POST');
    const payload = route.request().postDataJSON();
    expect(payload).toMatchObject({ customer_email: fixture.customer_email, total_price: 40000,
      wheel_type: 'aero', optionals: [], payment_method: 'avista', status: 'APROVADO' });
    expect(payload.order_number).toMatch(/^VLO-[A-Z0-9]{6}$/);
    inserted = true;
    await route.fulfill({ status: 201, json: { ...fixture, ...payload } });
  });
  await page.goto('/order');
  await fillCheckout(page, fixture.customer_email);
  await page.getByTestId('checkout-submit').click();
  await expect(page.getByTestId('success-status')).toHaveText('Pedido Aprovado!');
  await expect(page.getByTestId('order-id')).toHaveText(/^VLO-[A-Z0-9]{6}$/);
  expect(inserted).toBe(true);
});
