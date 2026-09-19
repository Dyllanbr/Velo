import { describe, expect, it } from 'vitest';
import { orderSchema } from './order-schema';

const validOrder = {
  name: 'Cliente',
  surname: 'Teste',
  email: 'cliente.teste+ci@example.test',
  phone: '(11) 99999-0000',
  cpf: '529.982.247-25',
  store: 'Velô Paulista - Av. Paulista, 1000',
  terms: true,
};

describe('validação dos dados do checkout', () => {
  it('valida o email no schema sem depender da validação nativa do navegador', () => {
    expect(orderSchema.safeParse(validOrder)).toEqual({ success: true, data: validOrder });

    for (const email of [
      'sem-arroba',
      'cliente@',
      'cliente@example',
      'cliente..teste@example.test',
      'cliente teste@example.test',
    ]) {
      const result = orderSchema.safeParse({ ...validOrder, email });
      expect(result.success, email).toBe(false);
      if (result.success === false) {
        expect(result.error.issues.map(({ path, message }) => ({ path, message })), email)
          .toEqual([{ path: ['email'], message: 'Email inválido' }]);
      }
    }
  });

  it('exige a máscara completa de CPF e mantém o erro restrito ao campo', () => {
    expect(orderSchema.safeParse(validOrder)).toEqual({ success: true, data: validOrder });

    // This schema checks formatting; it does not validate CPF check digits.
    for (const cpf of [
      '52998224725',
      '529.982.247-2_',
      '529-982-247-25',
      '529.982.247-2A',
    ]) {
      const result = orderSchema.safeParse({ ...validOrder, cpf });
      expect(result.success, cpf).toBe(false);
      if (result.success === false) {
        expect(result.error.issues.map(({ path, message }) => ({ path, message })), cpf)
          .toEqual([{ path: ['cpf'], message: 'CPF inválido' }]);
      }
    }
  });
});
