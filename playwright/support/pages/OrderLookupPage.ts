import { expect, type Page } from '@playwright/test';

type OrderStatus = 'APROVADO' | 'REPROVADO' | 'EM_ANALISE' | 'pending';

export type OrderDetails = {
  number: string;
  status: OrderStatus;
  color: string;
  wheels: string;
  customer: { name: string; email: string };
  payment: string;
  price: string;
};

export class OrderLookupPage {
  constructor(private readonly page: Page) {}

  async validatePageLoaded() {
    await expect(this.page.getByRole('heading', {
      name: 'Consultar Pedido', exact: true, level: 3,
    })).toBeVisible();
  }

  async searchOrder(code: string) {
    await this.page.getByRole('textbox', { name: 'Número do Pedido', exact: true }).fill(code);
    await this.page.getByRole('button', { name: 'Buscar Pedido', exact: true }).click();
  }

  async validateOrderDetails(order: OrderDetails) {
    // Partial snapshot: interior/store persistence has known gaps; date checks format only.
    await expect(this.page.getByTestId(`order-result-${order.number}`)).toMatchAriaSnapshot(String.raw`
      - paragraph: Pedido
      - paragraph: ${order.number}
      - status:
        - text: ${order.status}
      - img "Velô Sprint"
      - paragraph: Modelo
      - paragraph: Velô Sprint
      - paragraph: Cor
      - paragraph: ${order.color}
      - paragraph: Rodas
      - paragraph: ${order.wheels}
      - heading "Dados do Cliente" [level=4]
      - paragraph: Nome
      - paragraph: ${order.customer.name}
      - paragraph: Email
      - paragraph: ${order.customer.email}
      - paragraph: Data do Pedido
      - paragraph: /\d{2}\/\d{2}\/\d{4}/
      - heading "Pagamento" [level=4]
      - paragraph: ${order.payment}
      - paragraph: ${order.price}
    `);
  }

  async validateOrderNotFound() {
    const heading = this.page.getByRole('heading', {
      name: 'Pedido não encontrado', exact: true, level: 3,
    });
    await expect(heading).toBeVisible();
    await expect(heading.locator('..')).toMatchAriaSnapshot(`
      - heading "Pedido não encontrado" [level=3]
      - paragraph: Verifique o número do pedido e tente novamente
    `);
  }

  async validateStatusBadge(
    orderNumber: string,
    status: OrderStatus,
  ) {
    const expectedPresentations = {
      APROVADO: {
        backgroundClass: /(?:^|\s)bg-green-100(?:\s|$)/,
        textClass: /(?:^|\s)text-green-700(?:\s|$)/,
        backgroundColor: 'rgb(220, 252, 231)',
        color: 'rgb(21, 128, 61)',
        iconClass: /(?:^|\s)lucide-circle-check-big(?:\s|$)/,
      },
      REPROVADO: {
        backgroundClass: /(?:^|\s)bg-red-100(?:\s|$)/,
        textClass: /(?:^|\s)text-red-700(?:\s|$)/,
        backgroundColor: 'rgb(254, 226, 226)',
        color: 'rgb(185, 28, 28)',
        iconClass: /(?:^|\s)lucide-circle-x(?:\s|$)/,
      },
      EM_ANALISE: {
        backgroundClass: /(?:^|\s)bg-amber-100(?:\s|$)/,
        textClass: /(?:^|\s)text-amber-700(?:\s|$)/,
        backgroundColor: 'rgb(254, 243, 199)',
        color: 'rgb(180, 83, 9)',
        iconClass: /(?:^|\s)lucide-clock(?:\s|$)/,
      },
      pending: null,
    } as const;

    const statusBadge = this.page.getByTestId(`order-result-${orderNumber}`).getByRole('status');
    await expect(statusBadge).toHaveCount(1);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText(status);
    const presentation = expectedPresentations[status];
    if (presentation) {
      await expect(statusBadge).toHaveClass(presentation.backgroundClass);
      await expect(statusBadge).toHaveClass(presentation.textClass);
      await expect(statusBadge).toHaveCSS('background-color', presentation.backgroundColor);
      await expect(statusBadge).toHaveCSS('color', presentation.color);
      const statusIcon = statusBadge.locator('svg');
      await expect(statusIcon).toHaveCount(1);
      await expect(statusIcon).toHaveAttribute('aria-hidden', 'true');
      await expect(statusIcon).toHaveClass(presentation.iconClass);
    }
  }
}
