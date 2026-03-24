import { test, expect } from '@playwright/test'

test('deve consultar um pedido aprovado', async ({ page }) => {
  await page.goto('http://localhost:5173/')

  //checkpoint 1: verificar se a página de consulta de pedidos está visível
  await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint')

  // Acessar a página de consulta de pedidos
  await page.getByRole('link', { name: 'Consultar Pedido' }).click()

  //checkpoint 2: verificar se a página de consulta de pedidos está visível
  await expect(page.getByRole('heading')).toContainText('Consultar Pedido')


  await page.getByTestId('search-order-id').fill('VLO-HXX69M')

  await page.getByTestId('search-order-button').click()
  
  await page.getByTestId('order-result-id').click()

  await expect(page.getByTestId('order-result-id')).toBeVisible()
  await expect(page.getByTestId('order-result-id')).toContainText('VLO-HXX69M')

  await expect(page.getByTestId('order-result-status')).toBeVisible()
  await expect(page.getByTestId('order-result-status')).toContainText('APROVADO')
})