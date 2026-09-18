import { expect, type Page } from '@playwright/test';

// Adaptado de fernandopapito/velo, commit f69f8f5afa0b03b264b9ffb8b01003e520be3ed2:
// playwright/support/actions/configuratorActions.ts. Mantem apenas as actions do CT03
// e acrescenta a verificacao do estado de cada opcional.
export function createConfiguratorActions(page: Page) {
  const optionalCheckbox = (name: string | RegExp) => page.getByRole('checkbox', { name });

  return {
    async open() {
      await page.goto('/configure');
    },

    async expectPrice(price: string) {
      const total = page.getByTestId('total-price');
      await expect(total).toBeVisible();
      await expect(total).toHaveText(price);
    },

    async checkOptional(name: string | RegExp) {
      await expect(optionalCheckbox(name)).toBeVisible();
      await optionalCheckbox(name).check();
    },

    async uncheckOptional(name: string | RegExp) {
      await expect(optionalCheckbox(name)).toBeVisible();
      await optionalCheckbox(name).uncheck();
    },

    async expectOptionalChecked(name: string | RegExp, checked: boolean) {
      await expect(optionalCheckbox(name)).toBeChecked({ checked });
    },

    async finishConfigurator() {
      await page.getByRole('button', { name: 'Monte o Seu', exact: true }).click();
    },
  };
}
