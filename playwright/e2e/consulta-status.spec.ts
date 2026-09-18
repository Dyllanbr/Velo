import { test, expect, orderFixture } from '../support/mock';

const outcomes = [
  { status: 'APROVADO', message: null },
  { status: 'REPROVADO', message: null },
  { status: 'EM_ANALISE', message: 'Aguardando análise de crédito.' },
  { status: 'pending', message: 'Consulte o atendimento para confirmar este status.' },
] as const;

for (const outcome of outcomes.filter((item) => item.status !== 'REPROVADO')) {
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

test('consulta preserva o status REPROVADO retornado pela API', async ({ page }, testInfo) => {
  const order = {
    ...orderFixture(),
    status: 'REPROVADO',
    color: 'midnight-black',
    wheel_type: 'sport',
    optionals: ['precision-park', 'flux-capacitor'],
    customer_name: 'Cliente Reprovado',
    payment_method: 'avista',
    total_price: 52500,
  };
  const expected = {
    color: 'Midnight Black',
    wheels: 'sport Wheels',
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

  await page.goto('/lookup');
  await page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(order.order_number);
  await page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
  const orderGroup = page.getByRole('paragraph').filter({ hasText: /^Pedido$/ }).locator('..');
  await expect(orderGroup.getByText(order.order_number, { exact: true })).toBeVisible();
  await expect(page.getByText(order.status, { exact: true })).toBeVisible();
  await expect(page.getByText(order.customer_email, { exact: true })).toBeVisible();
  expect(requests).toEqual(['GET']);

  // Partial snapshot: interior/store persistence has known gaps; date checks format only.
  const resultCard = page.getByTestId(`order-result-${order.order_number}`);
  await expect(resultCard).toMatchAriaSnapshot(String.raw`
    - paragraph: Pedido
    - paragraph: ${order.order_number}
    - text: ${order.status}
    - img "Velô Sprint"
    - paragraph: Modelo
    - paragraph: Velô Sprint
    - paragraph: Cor
    - paragraph: ${expected.color}
    - paragraph: Rodas
    - paragraph: ${expected.wheels}
    - heading "Dados do Cliente" [level=4]
    - paragraph: Nome
    - paragraph: ${order.customer_name}
    - paragraph: Email
    - paragraph: ${order.customer_email}
    - paragraph: Data do Pedido
    - paragraph: /\d{2}\/\d{2}\/\d{4}/
    - heading "Pagamento" [level=4]
    - paragraph: ${expected.payment}
    - paragraph: ${expected.price}
  `);
  for (const other of outcomes.filter((item) => item.status !== 'REPROVADO')) {
    await expect(page.getByText(other.status, { exact: true })).toHaveCount(0);
    if (other.message) await expect(page.getByText(other.message, { exact: true })).toHaveCount(0);
  }
  await testInfo.attach('consulta.png', {
    contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
  });
});
