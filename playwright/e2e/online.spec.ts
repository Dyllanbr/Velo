import { test, expect } from '../support/mock';

test('página inicial e navegação para consulta', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Velô by Papito/);
  await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint');
  await page.getByRole('link', { name: 'Consultar Pedido' }).click();
  await expect(page.getByTestId('search-order-button')).toBeDisabled();
});

test('configuração atualiza preço e persiste após recarregar', async ({ page }) => {
  await page.goto('/configure');
  await expect(page.getByTestId('total-price')).toHaveText(/40\.000,00/);
  await page.getByTestId('wheel-option-sport').click();
  await page.getByTestId('opt-precision-park').check();
  await page.getByTestId('opt-flux-capacitor').check();
  await expect(page.getByTestId('total-price')).toHaveText(/52\.500,00/);
  await page.reload();
  await expect(page.getByTestId('total-price')).toHaveText(/52\.500,00/);
  await page.getByTestId('opt-precision-park').uncheck();
  await expect(page.getByTestId('total-price')).toHaveText(/47\.000,00/);
});
