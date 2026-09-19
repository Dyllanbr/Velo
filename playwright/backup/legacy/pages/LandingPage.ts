import { expect, type Page } from '@playwright/test';

export class LandingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
    await expect(this.page.getByTestId('hero-section').getByRole('heading', {
      name: 'Velô Sprint', exact: true, level: 1,
    })).toBeVisible();
  }
}
