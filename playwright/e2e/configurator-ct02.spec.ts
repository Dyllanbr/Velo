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

test('CT02 - cores preservam o preço e Sport acrescenta somente R$ 2.000,00', async ({ page }) => {
  // Arrange: contexto novo da fixture; nenhum reset do produto para mascarar o estado inicial.
  await page.goto('/configure');
  await expectConfiguration(page, {
    color: 'glacier-blue', wheels: 'aero', price: 'R$ 40.000,00',
  });

  // Act / Assert: os cinco estados vêm da exploração CUA documentada.
  await page.getByRole('button', { name: 'Midnight Black', exact: true }).click();
  await expectConfiguration(page, {
    color: 'midnight-black', wheels: 'aero', price: 'R$ 40.000,00',
  });

  await page.getByRole('button', { name: 'Lunar White', exact: true }).click();
  await expectConfiguration(page, {
    color: 'lunar-white', wheels: 'aero', price: 'R$ 40.000,00',
  });

  await page.getByRole('button', { name: /^Sport Wheels\b/ }).click();
  await expectConfiguration(page, {
    color: 'lunar-white', wheels: 'sport', price: 'R$ 42.000,00',
  });

  await page.getByRole('button', { name: /^Aero Wheels\b/ }).click();
  await expectConfiguration(page, {
    color: 'lunar-white', wheels: 'aero', price: 'R$ 40.000,00',
  });
});
