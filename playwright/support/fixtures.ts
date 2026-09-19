import { test as base } from './mock';
import { createConfiguratorActions } from './actions/configuratorActions';
import { createCheckoutActions } from './actions/checkoutActions';
import { createOrderLookupActions } from './actions/orderLookupActions';

type App = {
  configurator: ReturnType<typeof createConfiguratorActions>;
  checkout: ReturnType<typeof createCheckoutActions>;
  orderLookup: ReturnType<typeof createOrderLookupActions>;
};

// A composicao preserva a fixture automatica networkGuard do test local.
export const test = base.extend<{ app: App }>({
  app: async ({ page }, provideApp) => {
    await provideApp({
      configurator: createConfiguratorActions(page),
      checkout: createCheckoutActions(page),
      orderLookup: createOrderLookupActions(page),
    });
  },
});

export { expect } from './mock';
