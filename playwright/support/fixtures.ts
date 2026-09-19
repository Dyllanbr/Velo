import { test as base } from './mock';
import { createConfiguratorActions } from './actions/configuratorActions';
import { createCheckoutActions } from './actions/checkoutActions';
import { createOrderLookupActions } from './actions/orderLookupActions';
import { createHeroActions } from './actions/heroActions';
import { mockCreditAnalysis } from './mock.api';

type App = {
  configurator: ReturnType<typeof createConfiguratorActions>;
  checkout: ReturnType<typeof createCheckoutActions>;
  orderLookup: ReturnType<typeof createOrderLookupActions>;
  hero: ReturnType<typeof createHeroActions>;
  mock: { creditAnalysis: (score: number, expectedCpf: string) => ReturnType<typeof mockCreditAnalysis> };
};

// A composicao preserva a fixture automatica networkGuard do test local.
export const test = base.extend<{ app: App }>({
  app: async ({ page }, provideApp) => {
    await provideApp({
      configurator: createConfiguratorActions(page),
      checkout: createCheckoutActions(page),
      orderLookup: createOrderLookupActions(page),
      hero: createHeroActions(page),
      mock: { creditAnalysis: (score, expectedCpf) => mockCreditAnalysis(page, score, expectedCpf) },
    });
  },
});

export { expect } from './mock';
