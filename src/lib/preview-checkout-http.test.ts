import { describe, expect, it, vi } from 'vitest';
import { assertNoBypassReflection, createCheckoutWriteGate, validateCheckoutResponse } from '../../playwright/support/preview-checkout-http';
import { RESERVED_CHECKOUT } from '../../playwright/support/preview-checkout';

const backend = 'https://bcsepghyrzmabmmdinuy.supabase.co';
const app = 'https://fixture-checkout.vercel.app';
const target = `${backend}/rest/v1/orders?select=*`;
const payload = () => ({
  order_number: 'VLO-QA0101', color: 'glacier-blue', wheel_type: 'aero', optionals: [],
  customer_name: `${RESERVED_CHECKOUT.name} ${RESERVED_CHECKOUT.surname}`,
  customer_email: RESERVED_CHECKOUT.email, customer_phone: RESERVED_CHECKOUT.phone,
  customer_cpf: RESERVED_CHECKOUT.cpf, payment_method: 'avista', total_price: 40000, status: 'APROVADO',
});
const request = () => ({ url: target, origin: app, method: 'POST', body: Buffer.from(JSON.stringify(payload())) });

describe('one fixed checkout write permission, without any network', () => {
  it('accepts one valid POST and rejects a second before any asynchronous forwarding can begin', () => {
    const gate = createCheckoutWriteGate(backend, app);
    const first = gate.authorize(request());
    expect(first).toEqual({ kind: 'post', payload: payload() });
    expect(() => gate.authorize(request())).toThrow(/Only one/);
  });

  it.each([
    { url: 'https://zbfdffxonoztoydpdlru.supabase.co/rest/v1/orders?select=*' },
    { url: `${backend}/functions/v1/credit-analysis` },
    { url: `${target}&select=*` }, { url: `${target}&customer_email=eq.other` },
    { url: `${backend}/rest/v1/orders` }, { url: `${target}#fragment` },
    { method: 'GET' }, { method: 'DELETE' }, { origin: 'https://other.invalid' },
  ])('rejects a different destination/method/query/origin before authorization: %#', (change) => {
    const gate = createCheckoutWriteGate(backend, app);
    expect(() => gate.authorize({ ...request(), ...change })).toThrow();
  });

  it.each([
    { customer_email: 'other@example.invalid' }, { customer_cpf: '000.000.000-00' },
    { total_price: 40001 }, { payment_method: 'financiamento' }, { status: 'EM_ANALISE' },
    { optionals: ['precision-park'] }, { extra: true }, { order_number: 'VLO-INVALID' },
  ])('rejects a modified cash payload and never rearms its write permission: %#', (change) => {
    const gate = createCheckoutWriteGate(backend, app);
    expect(() => gate.authorize({ ...request(), body: Buffer.from(JSON.stringify({ ...payload(), ...change })) }))
      .toThrow(/reservation/);
    expect(() => gate.authorize(request())).toThrow(/Only one/);
  });

  it('allows only the bounded POST preflight and does not spend the POST permission on it', () => {
    const gate = createCheckoutWriteGate(backend, app);
    expect(gate.authorize({ ...request(), method: 'OPTIONS', body: null,
      preflightMethod: 'POST', preflightHeaders: 'apikey, authorization, content-type, prefer, x-client-info' }))
      .toEqual({ kind: 'preflight' });
    expect(gate.authorize(request()).kind).toBe('post');
  });

  it('rejects a secret-carrying preflight header before any request could be forwarded', () => {
    const gate = createCheckoutWriteGate(backend, app);
    expect(() => gate.authorize({ ...request(), method: 'OPTIONS', body: null,
      preflightMethod: 'POST', preflightHeaders: 'x-vercel-protection-bypass' })).toThrow(/preflight/);
  });

  it('correlates the one validated response and rejects a different order number', () => {
    const decision = createCheckoutWriteGate(backend, app).authorize(request());
    if (decision.kind !== 'post') throw new Error('Expected POST decision');
    const row = { ...payload(), id: '88502f65-b3c8-42af-a635-705fe4f4c7e9' };
    expect(validateCheckoutResponse(Buffer.from(JSON.stringify(row)), decision.payload))
      .toEqual({ id: row.id, order_number: row.order_number });
    expect(() => validateCheckoutResponse(Buffer.from(JSON.stringify({ ...row, order_number: 'VLO-QA0102' })), decision.payload))
      .toThrow(/submitted/);
  });

  it.each(['body', 'header'] as const)('blocks reflected bypass in the %s before accepting or fulfilling the response', (location) => {
    const canary = 'synthetic-bypass-canary-for-private-unit-only';
    const decision = createCheckoutWriteGate(backend, app).authorize(request());
    if (decision.kind !== 'post') throw new Error('Expected POST decision');
    const row = { ...payload(), id: '88502f65-b3c8-42af-a635-705fe4f4c7e9',
      extra: location === 'body' ? canary : 'unrelated metadata' };
    const response = { body: Buffer.from(JSON.stringify(row)),
      headers: { 'x-upstream-metadata': location === 'header' ? canary : 'safe' } };
    // A valid order signature alone does not validate extra response fields.
    expect(validateCheckoutResponse(response.body, decision.payload)).toEqual({ id: row.id, order_number: row.order_number });
    const fulfill = vi.fn();
    let acceptedPosts = 0;
    const acceptAndFulfill = () => {
      assertNoBypassReflection(response, canary);
      validateCheckoutResponse(response.body, decision.payload);
      acceptedPosts += 1;
      fulfill(response);
    };
    expect(acceptAndFulfill).toThrow('Protected response reflected a secret or the guard key is missing; content and headers omitted.');
    expect(acceptedPosts).toBe(0);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('keeps a non-reflecting valid order eligible for acceptance and fulfillment', () => {
    const decision = createCheckoutWriteGate(backend, app).authorize(request());
    if (decision.kind !== 'post') throw new Error('Expected POST decision');
    const row = { ...payload(), id: '88502f65-b3c8-42af-a635-705fe4f4c7e9', extra: 'unrelated metadata' };
    const response = { body: Buffer.from(JSON.stringify(row)), headers: { 'content-type': 'application/json' } };
    const fulfill = vi.fn();
    assertNoBypassReflection(response, 'synthetic-bypass-canary-for-private-unit-only');
    expect(validateCheckoutResponse(response.body, decision.payload)).toEqual({ id: row.id, order_number: row.order_number });
    fulfill(response);
    expect(fulfill).toHaveBeenCalledTimes(1);
    expect(fulfill).toHaveBeenCalledWith(response);
  });
});
