import { expect, type Page } from '@playwright/test';

type ConfigurationCheckpoint = {
  color: 'glacier-blue' | 'midnight-black' | 'lunar-white';
  wheels: 'aero' | 'sport';
  price: 'R$ 40.000,00' | 'R$ 42.000,00';
};

// Adaptado de fernandopapito/velo, commit f69f8f5afa0b03b264b9ffb8b01003e520be3ed2:
// playwright/support/actions/configuratorActions.ts. Preserva as actions do CT03
// e incorpora as selecoes e checkpoints locais de cores/rodas do CT02.
export function createConfiguratorActions(page: Page) {
  const optionalCheckbox = (name: string | RegExp) => page.getByRole('checkbox', { name });

  async function expectPrice(price: string) {
    const total = page.getByTestId('total-price');
    await expect(total).toBeVisible();
    await expect(total).toHaveText(price);
  }

  return {
    async open() {
      await page.goto('/configure');
    },

    async selectColor(name: string) {
      await page.getByRole('button', { name, exact: true }).click();
    },

    async selectWheels(name: string | RegExp) {
      await page.getByRole('button', { name }).click();
    },

    expectPrice,

    async expectConfiguration(expected: ConfigurationCheckpoint) {
      await expect(page).toHaveURL(/\/configure$/);
      await expectPrice(expected.price);
      await expect(page.getByRole('checkbox', { name: /Precision Park/ })).not.toBeChecked();
      await expect(page.getByRole('checkbox', { name: /Flux Capacitor/ })).not.toBeChecked();

      const image = page.getByRole('img', {
        name: `Velô Sprint - ${expected.color} with ${expected.wheels} wheels`,
        exact: true,
      });
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute(
        'src',
        new RegExp(`/${expected.color}-${expected.wheels}-wheels(?:-[A-Za-z0-9_-]{8})?\\.png(?:\\?.*)?$`),
      );
      await expect(image).toHaveJSProperty('complete', true);
      await expect.poll(async () => image.evaluate(
        (element: HTMLImageElement) => element.naturalWidth,
      )).toBeGreaterThan(0);
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
