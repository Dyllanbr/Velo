import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

type ConfigurationCheckpoint = {
  color: 'glacier-blue' | 'midnight-black' | 'lunar-white';
  wheels: 'aero' | 'sport';
  price: 'R$ 40.000,00' | 'R$ 42.000,00';
};

async function expectConfiguration(
  page: Page,
  expected: ConfigurationCheckpoint,
): Promise<void> {
  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByTestId('total-price')).toBeVisible();
  await expect(page.getByTestId('total-price')).toHaveText(expected.price);
  await expect(page.getByRole('checkbox', { name: /Precision Park/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Flux Capacitor/ })).not.toBeChecked();

  const image = page.getByRole('img', {
    name: `Velô Sprint - ${expected.color} with ${expected.wheels} wheels`,
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    'src',
    new RegExp(`/${expected.color}-${expected.wheels}-wheels\\.png(?:\\?.*)?$`),
  );
  await expect(image).toHaveJSProperty('complete', true);
  await expect.poll(async () => image.evaluate(
    (element: HTMLImageElement) => element.naturalWidth,
  )).toBeGreaterThan(0);
}

test.describe('Customização do veículo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/configure');
    await expectConfiguration(page, {
      color: 'glacier-blue', wheels: 'aero', price: 'R$ 40.000,00',
    });
  });

  test('CT02 - cores atualizam a imagem sem alterar o preço base', async ({ page }) => {
    await page.getByRole('button', { name: 'Midnight Black', exact: true }).click();
    await expectConfiguration(page, {
      color: 'midnight-black', wheels: 'aero', price: 'R$ 40.000,00',
    });

    await page.getByRole('button', { name: 'Lunar White', exact: true }).click();
    await expectConfiguration(page, {
      color: 'lunar-white', wheels: 'aero', price: 'R$ 40.000,00',
    });
  });

  const wheelScenarios = [
    { color: 'glacier-blue', label: 'Glacier Blue' },
    { color: 'lunar-white', label: 'Lunar White' },
  ] as const;

  for (const scenario of wheelScenarios) {
    test(`CT02 - rodas atualizam imagem e preço e retornam a Aero em ${scenario.label}`, async ({ page }) => {
      if (scenario.color === 'lunar-white') {
        await page.getByRole('button', { name: scenario.label, exact: true }).click();
        await expectConfiguration(page, {
          color: scenario.color, wheels: 'aero', price: 'R$ 40.000,00',
        });
      }

      await page.getByRole('button', { name: /^Sport Wheels\b/ }).click();
      await expectConfiguration(page, {
        color: scenario.color, wheels: 'sport', price: 'R$ 42.000,00',
      });

      await page.getByRole('button', { name: /^Aero Wheels\b/ }).click();
      await expectConfiguration(page, {
        color: scenario.color, wheels: 'aero', price: 'R$ 40.000,00',
      });
    });
  }
});
