import { type Page } from '@playwright/test';

export class Navbar {
  constructor(private readonly page: Page) {}

  async orderLookupLink() {
    await this.page.getByTestId('header-nav').getByRole('link', {
      name: 'Consultar Pedido', exact: true,
    }).click();
  }
}
