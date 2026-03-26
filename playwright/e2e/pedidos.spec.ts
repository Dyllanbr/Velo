import { test, expect } from '@playwright/test'

/// AAA - Arrange, Act, Assert  
test('deve consultar um pedido aprovado', async ({ page }) => {
  //arrange
  await page.goto('http://localhost:5173/')
  await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint')
  await page.getByRole('link', { name: 'Consultar Pedido' }).click()
  await expect(page.getByRole('heading')).toContainText('Consultar Pedido')

  //act
  await page.getByTestId('search-order-id').fill('VLO-HXX69M')
  await page.getByTestId('search-order-button').click()

  //assert
  await expect(page.getByTestId('order-result-id')).toBeVisible()
  await expect(page.getByTestId('order-result-id')).toContainText('VLO-HXX69M')

  await expect(page.getByTestId('order-result-status')).toBeVisible()
  await expect(page.getByTestId('order-result-status')).toContainText('APROVADO')
})