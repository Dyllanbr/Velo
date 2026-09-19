import { test, expect } from '../support/fixtures';
import { orderFixture } from '../support/mock';
import { type OrderDetails } from '../support/actions/orderLookupActions';

test.describe('Consulta de pedidos', () => {
  test.beforeEach(async ({ app }) => {
    await app.orderLookup.open();
  });

  test('consulta mantém busca desabilitada com campo vazio ou apenas espaços', async ({ app }) => {
    const button = app.orderLookup.elements.searchButton;
    await expect(button).toBeDisabled();
    await app.orderLookup.elements.orderInput.fill('   ');
    await expect(button).toBeDisabled();
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

test('checkout à vista envia configuração e apresenta o número retornado', async ({ page, context, app }, testInfo) => {
  const customer = {
    name: 'Cliente',
    surname: 'Checkout QA',
    email: 'qa-m4-checkout-local-3a897c20-2534-4219-8655-8bac5c546dbe@example.invalid',
    phone: '(11) 99999-0000',
    cpf: '968.314.027-04',
    store: 'Velô Paulista - Av. Paulista, 1000',
    paymentMethod: 'À Vista' as const,
    totalPrice: 40000,
  };
  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(customer.totalPrice).replace(/\u00a0/g, ' ');
  const attemptedPosts: string[] = [];
  const returnedOrderNumbers: string[] = [];
  context.on('request', (request) => {
    if (request.method() === 'POST') attemptedPosts.push(request.url());
  });
  await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().url()).toBe('https://velo-e2e.invalid/rest/v1/orders?select=*');
    const payload = route.request().postDataJSON();
    expect(payload).toEqual({
      order_number: expect.stringMatching(/^VLO-[A-Z0-9]{6}$/),
      customer_name: `${customer.name} ${customer.surname}`,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_cpf: customer.cpf,
      color: 'glacier-blue', wheel_type: 'aero', optionals: [],
      payment_method: 'avista', total_price: customer.totalPrice, status: 'APROVADO',
    });
    returnedOrderNumbers.push(payload.order_number);
    expect(returnedOrderNumbers, 'A compra deve enviar um único pedido').toHaveLength(1);
    await route.fulfill({ status: 201, json: {
      ...payload,
      id: '30ba4bb4-c0eb-4251-aadb-688b07204a04',
      created_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z',
    } });
  });

  // Arrange: the complete customer journey belongs to this case, not a shared hook.
  await page.goto('/');
  const hero = page.getByTestId('hero-section');
  await expect(hero.getByRole('heading', { name: 'Velô Sprint', level: 1, exact: true })).toBeVisible();
  await hero.getByRole('link', { name: 'Configure Agora', exact: true }).click();
  await expect(page).toHaveURL(/\/configure$/);
  await app.configurator.expectPrice(price);
  await app.configurator.finishConfigurator();
  await app.checkout.expectLoaded();
  await app.checkout.expectConfiguration({
    color: 'Glacier Blue', interior: 'carbon black', wheels: 'aero Wheels',
  });
  await app.checkout.expectNoOptionals();
  await app.checkout.fillCustomerData(customer);
  await app.checkout.selectStore(customer.store);

  // Act: explicitly select cash; any credit/backend request remains blocked by networkGuard.
  await app.checkout.selectPaymentMethod(customer.paymentMethod);
  await app.checkout.expectSummaryTotal(price);
  await app.checkout.acceptTerms();
  await app.checkout.submit();

  // Assert: correlate the displayed number with the actual mocked POST response.
  await expect(page).toHaveURL(/\/success$/);
  await expect(page.getByRole('heading', { name: 'Pedido Aprovado!', exact: true })).toBeVisible();
  expect(returnedOrderNumbers).toHaveLength(1);
  await expect(page.getByTestId('order-id')).toHaveText(returnedOrderNumbers[0]);
  await expect(page.getByText(`${customer.name} ${customer.surname}`, { exact: true })).toBeVisible();
  await expect(page.getByText(customer.email, { exact: true })).toBeVisible();
  await expect(page.getByText(customer.store, { exact: true })).toBeVisible();
  await expect(page.getByText(price, { exact: true })).toBeVisible();
  expect(attemptedPosts).toEqual(['https://velo-e2e.invalid/rest/v1/orders?select=*']);
  await testInfo.attach('checkout-cash-evidence.json', {
    contentType: 'application/json',
    body: JSON.stringify({ attemptedPosts, returnedOrderNumber: returnedOrderNumbers[0],
      totalPrice: customer.totalPrice, paymentMethod: customer.paymentMethod,
      scope: 'Local mocked API only; no database writes or cleanup.' }, null, 2),
  });
});
