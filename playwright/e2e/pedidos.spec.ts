import { test, expect, orderFixture, fillCheckout } from '../support/mock';

test('consulta normaliza número e exibe pedido aprovado criado pelo próprio teste', async ({ page }) => {
  const order = orderFixture();
  await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(new URL(route.request().url()).searchParams.get('order_number')).toBe(`eq.${order.order_number}`);
    await route.fulfill({ json: [order] });
  });
  await page.goto('/lookup');
  await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(`  ${order.order_number.toLowerCase()}  `);
  await page.getByTestId('search-order-button').click();
  const result = page.getByTestId(`order-result-${order.order_number}`);
  await expect(result).toBeVisible();
  await expect(result).toContainText(order.order_number);
  await expect(result).toContainText('APROVADO');
  await expect(result).toContainText(order.customer_email);
});

test('consulta informa quando não há pedido', async ({ page }) => {
  await page.route('https://velo-e2e.invalid/rest/v1/orders**', (route) => route.fulfill({ json: [] }));
  await page.goto('/lookup');
  await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(orderFixture().order_number);
  await page.getByTestId('search-order-button').click();
  await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible();
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
