import { test as base, expect } from '../support/fixtures';
import { orderFixture } from '../support/mock';
import type { createCheckoutActions } from '../support/actions/checkoutActions';
import type { Page } from '@playwright/test';

// Inherits networkGuard and records attempts, including requests that it aborts.
const test = base.extend<{ noPosts: void }>({
  noPosts: [async ({ context }, use, testInfo) => {
    const attemptedPosts: string[] = [];
    context.on('request', (request) => {
      if (request.method() === 'POST') attemptedPosts.push(request.url());
    });
    await use();
    await testInfo.attach('post-attempts.json', {
      contentType: 'application/json',
      body: JSON.stringify({ attemptedPosts, scope: 'Entire local test context; external APIs blocked.' }, null, 2),
    });
    expect(attemptedPosts, 'Formulário inválido não deve tentar nenhum POST').toEqual([]);
  }, { auto: true }],
});

test.beforeEach(async ({ page, app }) => {
  await page.goto('/order');
  await app.checkout.expectLoaded();
});

const fieldErrors = {
  name: 'Nome deve ter pelo menos 2 caracteres',
  surname: 'Sobrenome deve ter pelo menos 2 caracteres',
  email: 'Email inválido',
  phone: 'Telefone inválido',
  cpf: 'CPF inválido',
  store: 'Selecione uma loja',
  terms: 'Aceite os termos',
} as const;
type CheckoutField = keyof typeof fieldErrors;
type CheckoutAlerts = ReturnType<typeof createCheckoutActions>['elements']['alerts'];

async function expectOnlyErrors(alerts: CheckoutAlerts, expected: readonly CheckoutField[]) {
  for (const field of Object.keys(fieldErrors) as CheckoutField[]) {
    const alert = alerts[field];
    await expect(alert).toHaveCount(expected.includes(field) ? 1 : 0);
    if (expected.includes(field)) {
      await expect(alert).toBeVisible();
      await expect(alert).toHaveText(fieldErrors[field]);
    }
  }
}

async function prepareValidCheckout(page: Page, checkout: ReturnType<typeof createCheckoutActions>) {
  const fixture = orderFixture();
  await checkout.fillCustomerData({
    name: 'Cliente', surname: 'Teste', email: fixture.customer_email,
    phone: '11999990000', cpf: '00000000000',
  });
  await checkout.selectStore('Velô Paulista - Av. Paulista, 1000');
  await checkout.acceptTerms();
  for (const [field, value] of Object.entries({
    name: 'Cliente', surname: 'Teste', email: fixture.customer_email,
    phone: '(11) 99999-0000', cpf: '000.000.000-00',
  })) {
    await expect(page.getByTestId(`checkout-${field}`)).toHaveValue(value);
  }
  await expect(page.getByTestId('checkout-store')).toHaveText('Velô Paulista - Av. Paulista, 1000');
  await expect(checkout.elements.terms).toBeChecked();
  await expectOnlyErrors(checkout.elements.alerts, []);
}

test('checkout incompleto não envia pedido', async ({ page, app }) => {
  await app.checkout.submit();

  await expectOnlyErrors(app.checkout.elements.alerts, ['name', 'surname', 'email', 'phone', 'cpf', 'store', 'terms']);
  await expect(page).toHaveURL(/\/order$/);
});

for (const scenario of [
  { field: 'Nome', key: 'name' },
  { field: 'Sobrenome', key: 'surname' },
] as const) {
  test(`checkout recusa ${scenario.field.toLowerCase()} com um caractere e demais campos válidos`, async ({ page, app }) => {
    await prepareValidCheckout(page, app.checkout);
    const input = page.getByRole('textbox', { name: scenario.field, exact: true });
    await input.fill('A');
    await expect(input).toHaveValue('A');

    await app.checkout.submit();

    await expectOnlyErrors(app.checkout.elements.alerts, [scenario.key]);
    await expect(page).toHaveURL(/\/order$/);
  });
}

test('checkout recusa e-mail malformado pela validação nativa sem enviar pedido', async ({ page, app }, testInfo) => {
  await prepareValidCheckout(page, app.checkout);
  const email = page.getByTestId('checkout-email');
  await email.fill('sem-arroba');
  await expect(email).toHaveValue('sem-arroba');

  await app.checkout.submit();

  await expect.poll(() => email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
  const validity = await email.evaluate((input: HTMLInputElement) => ({
    value: input.value, typeMismatch: input.validity.typeMismatch, valid: input.validity.valid,
    messagePresent: input.validationMessage.length > 0,
  }));
  expect(validity).toEqual({ value: 'sem-arroba', typeMismatch: true, valid: false, messagePresent: true });
  await testInfo.attach('native-email-validity.json', {
    contentType: 'application/json', body: JSON.stringify(validity, null, 2),
  });
  // The browser blocks submit before the application's schema runs; no localized text assumed.
  await expectOnlyErrors(app.checkout.elements.alerts, []);
  await expect(page).toHaveURL(/\/order$/);
});

for (const field of [
  { key: 'cpf', value: '0000000000', error: 'CPF inválido' },
  { key: 'phone', value: '1199999000', error: 'Telefone inválido' },
] as const) {
  test(`checkout recusa máscara incompleta: ${field.error}`, async ({ page, app }) => {
    await prepareValidCheckout(page, app.checkout);
    const input = page.getByTestId(`checkout-${field.key}`);
    await input.fill(field.value);
    await expect(input).toHaveValue(/_/);

    await app.checkout.submit();

    await expectOnlyErrors(app.checkout.elements.alerts, [field.key]);
    await expect(page).toHaveURL(/\/order$/);
  });
}

test('checkout recusa termos não aceitos com demais campos válidos', async ({ page, app }) => {
  await prepareValidCheckout(page, app.checkout);
  const terms = app.checkout.elements.terms;
  await terms.uncheck();
  await expect(terms).not.toBeChecked();

  await app.checkout.submit();

  await expectOnlyErrors(app.checkout.elements.alerts, ['terms']);
  await expect(page).toHaveURL(/\/order$/);
});
