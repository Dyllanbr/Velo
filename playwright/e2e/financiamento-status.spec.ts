import { test, expect } from '../support/fixtures';
import { orderFixture, fillCheckout } from '../support/mock';

test.describe('Financiamento e confirmação', () => {
  // Only this group navigates before installing scenario-specific API mocks.
  // The automatic networkGuard is already active during this hook.
  test.beforeEach(async ({ app }) => {
    await app.hero.open();
  });

  const outcomes = [
    { score: 800, status: 'APROVADO', heading: 'Pedido Aprovado!',
      message: 'Seu pedido foi processado com sucesso. Em breve entraremos em contato.' },
    { score: 400, status: 'REPROVADO', heading: 'Pedido Reprovado!',
      message: 'Infelizmente seu crédito não foi aprovado. Tente novamente com pagamento à vista.' },
    { score: 600, status: 'EM_ANALISE', heading: 'Crédito em análise',
      message: 'Seu pedido foi registrado e aguarda análise de crédito.' },
  ] as const;

  for (const outcome of outcomes) {
    test(`financiamento com entrada zero apresenta ${outcome.status} sem confundir a decisão`, async ({ page, context, app }, testInfo) => {
      const fixture = orderFixture();
      const ordersEndpoint = 'https://velo-e2e.invalid/rest/v1/orders?select=*';
      const attemptedPosts: string[] = [];
      const orders: Record<string, unknown>[] = [];
      context.on('request', (request) => {
        if (request.method() === 'POST') attemptedPosts.push(request.url());
      });
      const { endpoint: creditEndpoint, requests: creditRequests } =
        await app.mock.creditAnalysis(outcome.score, fixture.customer_cpf);
      await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().url()).toBe(ordersEndpoint);
        expect(creditRequests).toHaveLength(1);
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({
          order_number: expect.stringMatching(/^VLO-[A-Z0-9]{6}$/),
          color: 'glacier-blue', wheel_type: 'aero', optionals: [],
          customer_name: fixture.customer_name, customer_email: fixture.customer_email,
          customer_phone: fixture.customer_phone, customer_cpf: fixture.customer_cpf,
          status: outcome.status, payment_method: 'financiamento', total_price: 40_800,
        });
        orders.push(payload);
        expect(orders).toHaveLength(1);
        // Echo the actual application payload, adding only database-generated metadata.
        // In particular, the mock must not inject the expected status into the response.
        await route.fulfill({ status: 201, json: {
          ...payload, id: fixture.id, created_at: fixture.created_at, updated_at: fixture.updated_at,
        } });
      });

      await app.configurator.expectPrice('R$ 40.000,00');
      await app.configurator.finishConfigurator();
      await app.checkout.expectLoaded();
      await app.checkout.expectNoOptionals();
      await fillCheckout(page, fixture.customer_email);
      await expect(page.getByTestId('summary-total-price')).toHaveText('R$ 40.000,00');
      await app.checkout.selectPaymentMethod('Financiamento');
      await app.checkout.fillDownPayment('0');
      // Characterizes the zero-entry example shown in the course; not a general interest-rule approval.
      await expect(page.getByTestId('summary-total-price')).toHaveText('R$ 40.800,00');
      const summaryTotalBeforeSubmit = await page.getByTestId('summary-total-price').innerText();
      await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

      await app.checkout.expectResult(outcome.heading);
      expect(creditRequests).toHaveLength(1);
      expect(orders).toHaveLength(1);
      expect(attemptedPosts).toEqual([creditEndpoint, ordersEndpoint]);
      expect(orders[0]).toMatchObject({
        status: outcome.status, payment_method: 'financiamento', customer_email: fixture.customer_email,
        customer_cpf: fixture.customer_cpf, total_price: 40_800,
      });
      await testInfo.attach('credit-decision-and-ui.json', {
        contentType: 'application/json',
        body: JSON.stringify({ creditRequests, attemptedPosts, mockedScore: outcome.score, submittedOrder: orders[0],
          summaryTotalBeforeSubmit, expectedZeroEntryTotal: 40_800,
          headingObserved: await page.getByTestId('success-status').innerText(),
          expectedHeading: outcome.heading, scope: 'Local UI and application logic; all APIs mocked.' }, null, 2),
      });
      await testInfo.attach('confirmation.png', {
        contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
      });

      await expect(page.getByText(outcome.message, { exact: true })).toBeVisible();
      await expect(page.getByTestId('order-id')).toHaveText(String(orders[0].order_number));
      await expect(page.getByText(fixture.customer_email, { exact: true })).toBeVisible();
      await expect(page.getByText('Velô Paulista - Av. Paulista, 1000', { exact: true })).toBeVisible();
      if (outcome.status !== 'REPROVADO') {
        await expect(page.getByRole('heading', { name: 'Pedido Reprovado!', exact: true })).toHaveCount(0);
        await expect(page.getByText('Crédito Reprovado', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Infelizmente seu crédito não foi aprovado.', { exact: false })).toHaveCount(0);
      }
    });
  }

  const lowScoreCases = [
    { title: 'sem entrada', downPayment: null, cpf: '111.444.777-35',
      financedSummary: 'R$ 40.800,00', orderTotal: 40_800 },
    { title: 'com entrada de 10000 abaixo de 50%', downPayment: '10000', cpf: '968.314.027-04',
      financedSummary: 'R$ 30.600,00', orderTotal: 40_600 },
  ] as const;

  for (const scenario of lowScoreCases) {
    test(`financiamento com score 500 ${scenario.title} reprova o crédito`, async ({ page, context, app }, testInfo) => {
      const fixture = orderFixture();
      const customer = {
        name: 'Cliente', surname: 'Fronteira Local',
        email: `a16-${scenario.downPayment ?? 'zero'}-${fixture.id}@example.invalid`,
        phone: '(11) 99999-0000', cpf: scenario.cpf,
        store: 'Velô Paulista - Av. Paulista, 1000',
      };
      const ordersEndpoint = 'https://velo-e2e.invalid/rest/v1/orders?select=*';
      const attemptedPosts: string[] = [];
      const orders: Record<string, unknown>[] = [];
      context.on('request', (request) => {
        if (request.method() === 'POST') attemptedPosts.push(request.url());
      });
      const { endpoint: creditEndpoint, requests: creditRequests } =
        await app.mock.creditAnalysis(500, customer.cpf);
      await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().url()).toBe(ordersEndpoint);
        expect(creditRequests).toHaveLength(1);
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({
          order_number: expect.stringMatching(/^VLO-[A-Z0-9]{6}$/),
          color: 'glacier-blue', wheel_type: 'aero', optionals: [],
          customer_name: `${customer.name} ${customer.surname}`,
          customer_email: customer.email, customer_phone: customer.phone, customer_cpf: customer.cpf,
          payment_method: 'financiamento', total_price: scenario.orderTotal, status: 'REPROVADO',
        });
        orders.push(payload);
        expect(orders).toHaveLength(1);
        // Echo the application's decision; do not manufacture the expected status in the response.
        await route.fulfill({ status: 201, json: {
          ...payload, id: fixture.id, created_at: fixture.created_at, updated_at: fixture.updated_at,
        } });
      });

      await app.configurator.expectPrice('R$ 40.000,00');
      await app.configurator.finishConfigurator();
      await app.checkout.expectLoaded();
      await app.checkout.expectNoOptionals();
      await app.checkout.expectSummaryTotal('R$ 40.000,00');
      await app.checkout.fillCustomerData(customer);
      await app.checkout.selectStore(customer.store);
      await app.checkout.selectPaymentMethod('Financiamento');
      const entry = page.getByTestId('input-entry-value');
      await expect(entry).toBeVisible();
      if (scenario.downPayment !== null) {
        await app.checkout.fillDownPayment(scenario.downPayment);
        await expect(entry).toHaveValue(scenario.downPayment);
      } else {
        // The controlled input renders zero as an empty value; leave it untouched in this case.
        await expect(entry).toHaveValue('');
      }
      const entryValueBeforeSubmit = await entry.inputValue();
      // Observed behavior: this summary excludes the entry; the submitted total includes it.
      // These two examples characterize current totals, not a general interest-rule approval.
      await app.checkout.expectSummaryTotal(scenario.financedSummary);
      const summaryTotalBeforeSubmit = await page.getByTestId('summary-total-price').innerText();
      await app.checkout.acceptTerms();
      await app.checkout.submit();

      await app.checkout.expectResult('Pedido Reprovado!');
      expect(creditRequests).toHaveLength(1);
      expect(orders).toHaveLength(1);
      expect(attemptedPosts).toEqual([creditEndpoint, ordersEndpoint]);

      await expect(page.getByText('Infelizmente seu crédito não foi aprovado. Tente novamente com pagamento à vista.',
        { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Pedido Aprovado!', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Crédito em análise', exact: true })).toHaveCount(0);
      await expect(page.getByTestId('order-id')).toHaveText(String(orders[0].order_number));
      await expect(page.getByText(customer.email, { exact: true })).toBeVisible();
      await expect(page.getByText(customer.store, { exact: true })).toBeVisible();
      await testInfo.attach('low-score-credit-decision-and-ui.json', {
        contentType: 'application/json',
        body: JSON.stringify({ mockedScore: 500, basePrice: 40_000,
          downPayment: Number(scenario.downPayment ?? 0), entryValueBeforeSubmit,
          creditRequests, attemptedPosts, submittedOrder: orders[0], summaryTotalBeforeSubmit,
          expectedOrderTotal: scenario.orderTotal,
          headingObserved: await page.getByTestId('success-status').innerText(),
          scope: 'Local UI and application logic; all APIs mocked; no database cleanup or provider call.' }, null, 2),
      });
      await testInfo.attach('confirmation.png', {
        contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
      });
    });
  }

  // A17 examples retain explicit inputs and independent expected amounts after the A18 extraction.
  const highEntryApprovalCases = [
    { title: 'entrada exatamente de 50%', score: 450, downPayment: '20000', cpf: '111.444.777-35',
      financedSummary: 'R$ 20.400,00', orderTotal: 40_400 },
    { title: 'entrada de 75% acima de 50%', score: 300, downPayment: '30000', cpf: '968.314.027-04',
      financedSummary: 'R$ 10.200,00', orderTotal: 40_200 },
  ] as const;

  for (const scenario of highEntryApprovalCases) {
    test(`financiamento com score ${scenario.score} e ${scenario.title} aprova o pedido`, async ({ page, context, app }, testInfo) => {
      const fixture = orderFixture();
      const customer = {
        name: 'Cliente', surname: 'Entrada Local',
        email: `a17-${scenario.downPayment}-${fixture.id}@example.invalid`,
        phone: '(11) 99999-0000', cpf: scenario.cpf,
        store: 'Velô Paulista - Av. Paulista, 1000',
      };
      const ordersEndpoint = 'https://velo-e2e.invalid/rest/v1/orders?select=*';
      const attemptedPosts: string[] = [];
      const orders: Record<string, unknown>[] = [];
      context.on('request', (request) => {
        if (request.method() === 'POST') attemptedPosts.push(request.url());
      });
      const { endpoint: creditEndpoint, requests: creditRequests } =
        await app.mock.creditAnalysis(scenario.score, customer.cpf);
      await page.route('https://velo-e2e.invalid/rest/v1/orders**', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().url()).toBe(ordersEndpoint);
        expect(creditRequests).toHaveLength(1);
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({
          order_number: expect.stringMatching(/^VLO-[A-Z0-9]{6}$/),
          color: 'glacier-blue', wheel_type: 'aero', optionals: [],
          customer_name: `${customer.name} ${customer.surname}`,
          customer_email: customer.email, customer_phone: customer.phone, customer_cpf: customer.cpf,
          payment_method: 'financiamento', total_price: scenario.orderTotal, status: 'APROVADO',
        });
        orders.push(payload);
        expect(orders).toHaveLength(1);
        // Echo the application's decision; do not manufacture the expected status in the response.
        await route.fulfill({ status: 201, json: {
          ...payload, id: fixture.id, created_at: fixture.created_at, updated_at: fixture.updated_at,
        } });
      });

      await app.configurator.expectPrice('R$ 40.000,00');
      await app.configurator.finishConfigurator();
      await app.checkout.expectLoaded();
      await app.checkout.expectNoOptionals();
      await app.checkout.expectSummaryTotal('R$ 40.000,00');
      await app.checkout.fillCustomerData(customer);
      await app.checkout.selectStore(customer.store);
      await app.checkout.selectPaymentMethod('Financiamento');
      const entry = page.getByTestId('input-entry-value');
      await expect(entry).toBeVisible();
      await app.checkout.fillDownPayment(scenario.downPayment);
      await expect(entry).toHaveValue(scenario.downPayment);
      const entryValueBeforeSubmit = await entry.inputValue();
      // Observed behavior: this summary excludes the entry; the submitted total includes it.
      // These two examples characterize current totals, not a general interest-rule approval.
      await app.checkout.expectSummaryTotal(scenario.financedSummary);
      const summaryTotalBeforeSubmit = await page.getByTestId('summary-total-price').innerText();
      await app.checkout.acceptTerms();
      await app.checkout.submit();

      await app.checkout.expectResult('Pedido Aprovado!');
      expect(creditRequests).toHaveLength(1);
      expect(orders).toHaveLength(1);
      expect(attemptedPosts).toEqual([creditEndpoint, ordersEndpoint]);

      await expect(page.getByText('Seu pedido foi processado com sucesso. Em breve entraremos em contato.',
        { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Crédito Reprovado', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Pedido Reprovado!', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Crédito em análise', exact: true })).toHaveCount(0);
      await expect(page.getByTestId('order-id')).toHaveText(String(orders[0].order_number));
      await expect(page.getByText(customer.email, { exact: true })).toBeVisible();
      await expect(page.getByText(customer.store, { exact: true })).toBeVisible();
      await testInfo.attach('high-entry-credit-decision-and-ui.json', {
        contentType: 'application/json',
        body: JSON.stringify({ mockedScore: scenario.score, basePrice: 40_000,
          downPayment: Number(scenario.downPayment), entryRatio: Number(scenario.downPayment) / 40_000, entryValueBeforeSubmit,
          creditRequests, attemptedPosts, submittedOrder: orders[0], summaryTotalBeforeSubmit,
          expectedOrderTotal: scenario.orderTotal,
          headingObserved: await page.getByTestId('success-status').innerText(),
          scope: 'Local UI and application logic; all APIs mocked; no database cleanup or provider call.' }, null, 2),
      });
      await testInfo.attach('confirmation.png', {
        contentType: 'image/png', body: await page.screenshot({ animations: 'disabled' }),
      });
    });
  }
});
