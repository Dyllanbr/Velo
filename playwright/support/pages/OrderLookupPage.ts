import type { Page } from '@playwright/test';

export class OrderLookupPage {
  constructor(private readonly page: Page) {}

  async searchOrder(code: string) {
    await this.page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(code);
    await this.page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
  }
}
