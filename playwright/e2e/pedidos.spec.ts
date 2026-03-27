import { test, expect } from '@playwright/test'

/// AAA - Arrange, Act, Assert  

test('deve consultar um pedido aprovado', async ({ page }) => {

// Test Data

const order = 'VLO-HXX69M'

  //arrange
  await page.goto('http://localhost:5173/')
  await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint')

  await page.getByRole('link', { name: 'Consultar Pedido' }).click()
  await expect(page.getByRole('heading')).toContainText('Consultar Pedido')

  //act
  
  await page.getByTestId('search-order-id').fill(order)
  await page.getByTestId('search-order-button').click()

 // Assert

  const containerPedido = page.getByRole('paragraph')
  .filter({ hasText: /^Pedido$/ })
  .locator('..') // Sobe para o elemento pai (a div que agrupa ambos)

  await expect(containerPedido).toContainText(order, {  timeout: 10_000 })

  await expect(page.getByText('APROVADO')).toBeVisible()
  
  })