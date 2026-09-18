import { expect, type Page } from '@playwright/test';

// expectLoaded/expectSummaryTotal adaptados de fernandopapito/velo,
// commit f69f8f5afa0b03b264b9ffb8b01003e520be3ed2, checkoutActions.ts.
// Validacoes de URL/configuracao/opcionais acrescentadas a partir da exploracao CT03.
export function createCheckoutActions(page: Page) {
  const configuration = page.getByRole('list').filter({ has: page.getByText('Cor', { exact: true }) });

  return {
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
