import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const test = base.extend<{ networkGuard: void }>({
  networkGuard: [async ({ context }, use) => {
    const unexpected: string[] = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4173') return route.continue();
      if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) unexpected.push(url.origin);
      await route.abort();
    });
    await use();
    expect(unexpected, 'Todas as APIs devem ter mock; nenhuma requisição externa é permitida').toEqual([]);
  }, { auto: true }],
});
export { expect };

export function orderFixture() {
  return {
    id: randomUUID(), order_number: `VLO-${randomUUID().slice(0, 8).toUpperCase()}`,
    color: 'glacier-blue', wheel_type: 'aero', optionals: [],
    customer_name: 'Cliente Teste', customer_email: `e2e-${randomUUID()}@example.invalid`,
    customer_phone: '(11) 99999-0000', customer_cpf: '000.000.000-00',
    payment_method: 'avista', total_price: 40000, status: 'APROVADO',
    created_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z',
  };
}

export async function fillCheckout(page: Page, email: string) {
  await page.getByTestId('checkout-name').fill('Cliente');
  await page.getByTestId('checkout-surname').fill('Teste');
  await page.getByTestId('checkout-email').fill(email);
  await page.getByTestId('checkout-phone').fill('11999990000');
  await page.getByTestId('checkout-cpf').fill('00000000000');
  await page.getByTestId('checkout-store').click();
  await page.getByRole('option', { name: 'Velô Paulista - Av. Paulista, 1000' }).click();
  await page.getByTestId('checkout-terms').check();
}
