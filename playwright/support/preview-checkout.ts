// A separate, fixed reservation for browser-created checkout orders, never the lookup JSON.
// The CPF has synthetic check digits; that alone cannot prove absence of a real holder.
// Ownership requires the exact email and the full stored signature below as well.
export const RESERVED_CHECKOUT = Object.freeze({
  name: 'Cliente',
  surname: 'Preview Checkout QA',
  email: 'qa-m4-checkout-b87b01e3-b90a-42d7-b4ce-25d65217dfcc@example.invalid',
  phone: '(11) 99999-0107',
  cpf: '572.906.184-66',
  store: 'Velô Paulista - Av. Paulista, 1000',
  paymentMethod: 'À Vista' as const,
  totalPrice: 40000,
});

export type PreviewCheckoutFixture = typeof RESERVED_CHECKOUT;
export const MAX_CHECKOUT_ROWS = 10;

export type CheckoutRow = {
  id: string; order_number: string; customer_name: string; customer_email: string;
  customer_phone: string; customer_cpf: string; color: string; wheel_type: string;
  optionals: string[] | null; payment_method: string; total_price: string; status: string;
};

export class CheckoutGuardError extends Error {}

function owns(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function assertCheckoutFixture(value: unknown): asserts value is PreviewCheckoutFixture {
  const expected = Object.entries(RESERVED_CHECKOUT);
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Reflect.ownKeys(value).length !== expected.length
    || expected.some(([key, field]) => !owns(value, key)
      || Object.getOwnPropertyDescriptor(value, key)?.value !== field)) {
    throw new CheckoutGuardError('Checkout fixture does not match its exact reservation; values omitted.');
  }
}

// Fixed defaults of this one cash checkout, not a general authorization mapper.
const signature = Object.freeze({
  customer_name: `${RESERVED_CHECKOUT.name} ${RESERVED_CHECKOUT.surname}`,
  customer_email: RESERVED_CHECKOUT.email,
  customer_phone: RESERVED_CHECKOUT.phone,
  customer_cpf: RESERVED_CHECKOUT.cpf,
  color: 'glacier-blue', wheel_type: 'aero', payment_method: 'avista', status: 'APROVADO',
});

export function assertOwnedCheckoutRows(rows: readonly CheckoutRow[]): void {
  if (rows.length > MAX_CHECKOUT_ROWS) {
    throw new CheckoutGuardError('Checkout candidate limit exceeded; no deletion is allowed.');
  }
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null
      || !owns(row, 'id') || typeof row.id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)
      || !owns(row, 'order_number') || typeof row.order_number !== 'string'
      || !/^VLO-[A-Z0-9]{6}$/.test(row.order_number)
      || ids.has(row.id) || numbers.has(row.order_number)
      || Object.entries(signature).some(([key, field]) => !owns(row, key)
        || (row as unknown as Record<string, unknown>)[key] !== field)
      // pg NUMERIC is text; allow only equivalent representations of this exact total.
      || !owns(row, 'total_price') || typeof row.total_price !== 'string'
      || !/^40000(?:\.0{1,2})?$/.test(row.total_price)
      || !owns(row, 'optionals') || !Array.isArray(row.optionals) || row.optionals.length !== 0) {
      throw new CheckoutGuardError('Checkout identity or signature conflicts; no deletion is allowed.');
    }
    ids.add(row.id);
    numbers.add(row.order_number);
  }
}
