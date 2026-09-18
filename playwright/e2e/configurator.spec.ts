import { test } from '../support/fixtures';

// CT03: enunciado do campus e exploracao manual concluida em 18/09/2026.
test('CT03 - opcionais recalculam o preco e a configuracao chega ao checkout', async ({ app }) => {
  const precisionPark = /Precision Park/i;
  const fluxCapacitor = /Flux Capacitor/i;

  // Arrange
  await app.configurator.open();
  await app.configurator.expectPrice('R$ 40.000,00');
  await app.configurator.expectOptionalChecked(precisionPark, false);
  await app.configurator.expectOptionalChecked(fluxCapacitor, false);

  // Act / Assert: cada transicao tem seu preco e estado verificados.
  await app.configurator.checkOptional(precisionPark);
  await app.configurator.expectOptionalChecked(precisionPark, true);
  await app.configurator.expectOptionalChecked(fluxCapacitor, false);
  await app.configurator.expectPrice('R$ 45.500,00');

  await app.configurator.checkOptional(fluxCapacitor);
  await app.configurator.expectOptionalChecked(precisionPark, true);
  await app.configurator.expectOptionalChecked(fluxCapacitor, true);
  await app.configurator.expectPrice('R$ 50.500,00');

  await app.configurator.uncheckOptional(precisionPark);
  await app.configurator.expectOptionalChecked(precisionPark, false);
  await app.configurator.expectOptionalChecked(fluxCapacitor, true);
  await app.configurator.expectPrice('R$ 45.000,00');

  await app.configurator.uncheckOptional(fluxCapacitor);
  await app.configurator.expectOptionalChecked(precisionPark, false);
  await app.configurator.expectOptionalChecked(fluxCapacitor, false);
  await app.configurator.expectPrice('R$ 40.000,00');

  await app.configurator.finishConfigurator();
  await app.checkout.expectLoaded();
  await app.checkout.expectSummaryTotal('R$ 40.000,00');
  await app.checkout.expectConfiguration({
    color: 'Glacier Blue', interior: 'carbon black', wheels: 'aero Wheels',
  });
  await app.checkout.expectNoOptionals();
});
