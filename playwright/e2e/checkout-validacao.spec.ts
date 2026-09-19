import { test as base, expect, orderFixture, fillCheckout } from '../support/mock';
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

test.beforeEach(async ({ page }) => {
  await page.goto('/order');
  await expect(page.getByRole('heading', { name: 'Finalizar Pedido', exact: true })).toBeVisible();
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

async function expectOnlyErrors(page: Page, expected: readonly CheckoutField[]) {
  for (const field of Object.keys(fieldErrors) as CheckoutField[]) {
    // Order.tsx groups each control and its error together; terms nests its paragraph once.
    const alert = page.getByTestId(`checkout-${field}`).locator('..').getByRole('paragraph');
    await expect(alert).toHaveCount(expected.includes(field) ? 1 : 0);
    if (expected.includes(field)) {
      await expect(alert).toBeVisible();
      await expect(alert).toHaveText(fieldErrors[field]);
    }
  }
}

async function prepareValidCheckout(page: Page) {
  const fixture = orderFixture();
  await fillCheckout(page, fixture.customer_email);
  for (const [field, value] of Object.entries({
    name: 'Cliente', surname: 'Teste', email: fixture.customer_email,
    phone: '(11) 99999-0000', cpf: '000.000.000-00',
  })) {
    await expect(page.getByTestId(`checkout-${field}`)).toHaveValue(value);
  }
  await expect(page.getByTestId('checkout-store')).toHaveText('Velô Paulista - Av. Paulista, 1000');
  await expect(page.getByTestId('checkout-terms')).toBeChecked();
  await expectOnlyErrors(page, []);
}

test('checkout incompleto não envia pedido', async ({ page }) => {
  await page.getByTestId('checkout-submit').click();

  await expectOnlyErrors(page, ['name', 'surname', 'email', 'phone', 'cpf', 'store', 'terms']);
  await expect(page).toHaveURL(/\/order$/);
});

for (const scenario of [
  { field: 'Nome', key: 'name' },
  { field: 'Sobrenome', key: 'surname' },
] as const) {
  test(`checkout recusa ${scenario.field.toLowerCase()} com um caractere e demais campos válidos`, async ({ page }) => {
    await prepareValidCheckout(page);
    const input = page.getByRole('textbox', { name: scenario.field, exact: true });
    await input.fill('A');
    await expect(input).toHaveValue('A');

    await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

    await expectOnlyErrors(page, [scenario.key]);
    await expect(page).toHaveURL(/\/order$/);
  });
}

test('checkout recusa e-mail malformado pela validação nativa sem enviar pedido', async ({ page }, testInfo) => {
  await prepareValidCheckout(page);
  const email = page.getByTestId('checkout-email');
  await email.fill('sem-arroba');
  await expect(email).toHaveValue('sem-arroba');

  await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

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
  await expectOnlyErrors(page, []);
  await expect(page).toHaveURL(/\/order$/);
});

for (const field of [
  { key: 'cpf', value: '0000000000', error: 'CPF inválido' },
  { key: 'phone', value: '1199999000', error: 'Telefone inválido' },
] as const) {
  test(`checkout recusa máscara incompleta: ${field.error}`, async ({ page }) => {
    await prepareValidCheckout(page);
    const input = page.getByTestId(`checkout-${field.key}`);
    await input.fill(field.value);
    await expect(input).toHaveValue(/_/);

    await page.getByTestId('checkout-submit').click();

    await expectOnlyErrors(page, [field.key]);
    await expect(page).toHaveURL(/\/order$/);
  });
}

test('checkout recusa termos não aceitos com demais campos válidos', async ({ page }) => {
  await prepareValidCheckout(page);
  const terms = page.getByRole('checkbox', {
    name: 'Li e aceito os Termos de Uso e Política de Privacidade', exact: true,
  });
  await terms.uncheck();
  await expect(terms).not.toBeChecked();

  await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

  await expectOnlyErrors(page, ['terms']);
  await expect(page).toHaveURL(/\/order$/);
});
