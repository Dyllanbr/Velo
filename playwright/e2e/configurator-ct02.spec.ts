import { test } from '../support/fixtures';

test.describe('Customização do veículo', () => {
  test.beforeEach(async ({ app }) => {
    await app.configurator.open();
    await app.configurator.expectConfiguration({
      color: 'glacier-blue', wheels: 'aero', price: 'R$ 40.000,00',
    });
  });

  test('CT02 - cores atualizam a imagem sem alterar o preço base', async ({ app }) => {
    await app.configurator.selectColor('Midnight Black');
    await app.configurator.expectConfiguration({
      color: 'midnight-black', wheels: 'aero', price: 'R$ 40.000,00',
    });

    await app.configurator.selectColor('Lunar White');
    await app.configurator.expectConfiguration({
      color: 'lunar-white', wheels: 'aero', price: 'R$ 40.000,00',
    });
  });

  const wheelScenarios = [
    { color: 'glacier-blue', label: 'Glacier Blue' },
    { color: 'lunar-white', label: 'Lunar White' },
  ] as const;

  for (const scenario of wheelScenarios) {
    test(`CT02 - rodas atualizam imagem e preço e retornam a Aero em ${scenario.label}`, async ({ app }) => {
      if (scenario.color === 'lunar-white') {
        await app.configurator.selectColor(scenario.label);
        await app.configurator.expectConfiguration({
          color: scenario.color, wheels: 'aero', price: 'R$ 40.000,00',
        });
      }

      await app.configurator.selectWheels(/^Sport Wheels\b/);
      await app.configurator.expectConfiguration({
        color: scenario.color, wheels: 'sport', price: 'R$ 42.000,00',
      });

      await app.configurator.selectWheels(/^Aero Wheels\b/);
      await app.configurator.expectConfiguration({
        color: scenario.color, wheels: 'aero', price: 'R$ 40.000,00',
      });
    });
  }
});
