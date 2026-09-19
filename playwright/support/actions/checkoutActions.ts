import { expect, type Page } from '@playwright/test';

// expectLoaded/expectSummaryTotal adaptados de fernandopapito/velo,
// commit f69f8f5afa0b03b264b9ffb8b01003e520be3ed2, checkoutActions.ts.
// Validacoes de URL/configuracao/opcionais acrescentadas a partir da exploracao CT03.
export function createCheckoutActions(page: Page) {
  const configuration = page.getByRole('list').filter({ has: page.getByText('Cor', { exact: true }) });

  const terms = page.getByRole('checkbox', {
    name: 'Li e aceito os Termos de Uso e Política de Privacidade', exact: true,
  });

  return {
    elements: { terms },

    async fillCustomerData(data: { name: string; surname: string; email: string; phone: string; cpf: string }) {
      await page.getByTestId('checkout-name').fill(data.name);
      await page.getByTestId('checkout-surname').fill(data.surname);
      await page.getByTestId('checkout-email').fill(data.email);
      await page.getByTestId('checkout-phone').fill(data.phone);
      await page.getByTestId('checkout-cpf').fill(data.cpf);
    },

    async selectStore(storeName: string) {
      await page.getByTestId('checkout-store').click();
      await page.getByRole('option', { name: storeName, exact: true }).click();
    },

    async acceptTerms() {
      await terms.check();
    },

    async submit() {
      await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();
    },
    async expectLoaded() {
      await expect(page).toHaveURL(/\/order$/);
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido', exact: true })).toBeVisible();
    },

    async expectSummaryTotal(price: string) {
      await expect(page.getByTestId('summary-total-price')).toHaveText(price);
    },

    async expectConfiguration(expected: { color: string; interior: string; wheels: string }) {
      await expect(configuration).toHaveCount(1);
      await expect(configuration.getByText(expected.color, { exact: true })).toBeVisible();
      await expect(configuration.getByText(expected.interior, { exact: true })).toBeVisible();
      await expect(configuration.getByText(expected.wheels, { exact: true })).toBeVisible();
    },

    async expectNoOptionals() {
      await expect(configuration.getByRole('listitem')).toHaveCount(3);
      await expect(configuration.getByText('Precision Park', { exact: true })).toHaveCount(0);
      await expect(configuration.getByText('Flux Capacitor', { exact: true })).toHaveCount(0);
    },
  };
}
