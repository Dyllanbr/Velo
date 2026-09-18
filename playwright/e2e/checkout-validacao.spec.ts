import { test as base, expect, orderFixture, fillCheckout } from '../support/mock';

// Inherits networkGuard and records attempts, including requests that it aborts.
const test = base.extend<{ noPosts: void }>({
  noPosts: [async ({ context }, use, testInfo) => {
    const attemptedPosts: string[] = [];
    context.on('request', (request) => {
      if (request.method() === 'POST') attemptedPosts.push(request.url());
    });
    await use();
    await testInfo.attach('post-attempts.json', {
      contentType: 'application/json',
      body: JSON.stringify({ attemptedPosts, scope: 'Entire local test context; external APIs blocked.' }, null, 2),
    });
    expect(attemptedPosts, 'Formulário inválido não deve tentar nenhum POST').toEqual([]);
  }, { auto: true }],
});

for (const scenario of [
  { field: 'Nome', error: 'Nome deve ter pelo menos 2 caracteres' },
  { field: 'Sobrenome', error: 'Sobrenome deve ter pelo menos 2 caracteres' },
]) {
  test(`checkout recusa ${scenario.field.toLowerCase()} com um caractere e demais campos válidos`, async ({ page }) => {
    const fixture = orderFixture();
    await page.goto('/order');
    await fillCheckout(page, fixture.customer_email);
    await page.getByRole('textbox', { name: scenario.field, exact: true }).fill('A');

    await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

    await expect(page.getByText(scenario.error, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/order$/);
  });
}

test('checkout recusa termos não aceitos com demais campos válidos', async ({ page }) => {
  const fixture = orderFixture();
  await page.goto('/order');
  await fillCheckout(page, fixture.customer_email);
  const terms = page.getByRole('checkbox', {
    name: 'Li e aceito os Termos de Uso e Política de Privacidade', exact: true,
  });
  await terms.uncheck();
  await expect(terms).not.toBeChecked();

  await page.getByRole('button', { name: 'Confirmar Pedido', exact: true }).click();

  await expect(page.getByText('Aceite os termos', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/order$/);
});
