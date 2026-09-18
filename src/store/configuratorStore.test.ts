import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateInstallment, calculateTotalPrice, formatPrice, useConfiguratorStore,
  type CarConfiguration,
} from './configuratorStore';

const base: CarConfiguration = {
  exteriorColor: 'glacier-blue', interiorColor: 'carbon-black', wheelType: 'aero', optionals: [],
};

describe('preço da configuração', () => {
  it.each([
    ['aero', [], 40000],
    ['sport', [], 42000],
    ['aero', ['precision-park'], 45500],
    ['aero', ['flux-capacitor'], 45000],
    ['sport', ['precision-park', 'flux-capacitor'], 52500],
  ] as const)('rodas %s, opcionais %j = R$ %i', (wheelType, optionals, expected) => {
    expect(calculateTotalPrice({ ...base, wheelType, optionals: [...optionals] })).toBe(expected);
  });

  it('cor não muda o preço', () => {
    expect(calculateTotalPrice({ ...base, exteriorColor: 'midnight-black', interiorColor: 'deep-blue' }))
      .toBe(40000);
  });

  it('ignora opcionais obsoletos de configurações persistidas', () => {
    const oldConfiguration = { ...base, optionals: ['removed-feature', 'precision-park'] };
    expect(calculateTotalPrice(oldConfiguration as CarConfiguration)).toBe(45500);
    expect(calculateTotalPrice({ ...base, optionals: null } as CarConfiguration)).toBe(40000);
  });

  it('formata reais com casas decimais e separador de milhar', () => {
    expect(formatPrice(52500.5).replace(/\s/g, ' ')).toBe('R$ 52.500,50');
  });
});

describe('estado do configurador', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.setState({ configuration: { ...base, optionals: [] }, viewMode: 'exterior' });
  });

  it('adiciona e remove um opcional sem duplicar ou perder a outra seleção', () => {
    const { toggleOptional } = useConfiguratorStore.getState();
    toggleOptional('precision-park');
    toggleOptional('flux-capacitor');
    toggleOptional('precision-park');
    expect(useConfiguratorStore.getState().configuration.optionals).toEqual(['flux-capacitor']);
    expect(calculateTotalPrice(useConfiguratorStore.getState().configuration)).toBe(45000);
  });

  it('mudar rodas preserva cor e opcionais; reset restaura a configuração básica', () => {
    const store = useConfiguratorStore.getState();
    store.setExteriorColor('lunar-white');
    store.toggleOptional('precision-park');
    store.setWheelType('sport');
    expect(useConfiguratorStore.getState().configuration).toEqual({
      ...base, exteriorColor: 'lunar-white', wheelType: 'sport', optionals: ['precision-park'],
    });
    store.resetConfiguration();
    expect(useConfiguratorStore.getState().configuration).toEqual(base);
  });
});

// This exported helper uses compound interest. Checkout currently has a separate formula;
// these checks intentionally do not claim to validate checkout financing.
describe('helper de parcelas compostas: 12 meses a 2% a.m.', () => {
  it.each([[0, 0], [12000, 1134.72], [40000, 3782.38]])('principal %i -> parcela %f', (principal, expected) => {
    expect(calculateInstallment(principal)).toBe(expected);
  });
});
