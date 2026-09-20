import { expect, type Page } from '@playwright/test';

export function createHeroActions(page: Page) {
  return {
    async open() {
      await page.goto('/');
      const hero = page.getByTestId('hero-section');
      await expect(hero.getByRole('heading', { name: 'Velô Sprint', level: 1, exact: true })).toBeVisible();
      await hero.getByRole('link', { name: 'Configure Agora', exact: true }).click();
      await expect(page).toHaveURL(/\/configure$/);
    },
  };
}
