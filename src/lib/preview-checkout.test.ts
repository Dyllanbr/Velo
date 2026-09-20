import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_PREVIEW_REF, RESERVED_ORDERS, withOwnedPreviewCheckout } from '../../playwright/support/preview-database';
import { assertCheckoutFixture, assertOwnedCheckoutRows, MAX_CHECKOUT_ROWS,
  RESERVED_CHECKOUT, type CheckoutRow } from '../../playwright/support/preview-checkout';

const poolConstructor = vi.hoisted(() => vi.fn<() => unknown>());
vi.mock('pg', () => ({ Pool: poolConstructor }));
beforeEach(() => poolConstructor.mockReset());

const marker = { environment: 'preview', supabaseProjectRef: DATABASE_PREVIEW_REF, sha: 'a'.repeat(40) };
const canary = 'fake-driver-details-must-not-escape';
function environment() {
  return {
    E2E_PREVIEW_ALLOWED: 'true', E2E_PREVIEW_DATABASE_ALLOWED: 'true',
    PREVIEW_SUPABASE_PROJECT_REF: DATABASE_PREVIEW_REF,
    PREVIEW_SUPABASE_URL: `https://${DATABASE_PREVIEW_REF}.supabase.co`,
    PREVIEW_SUPABASE_ANON_KEY: 'sb_publishable_fixture_preview',
    E2E_BASE_URL: 'https://fixture-only.vercel.app', E2E_EXPECTED_SHA: 'a'.repeat(40),
    TEST_DATABASE_URL: `postgresql://postgres:fixture-password@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
  };
}

function order(index = 1): CheckoutRow {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    order_number: `VLO-T${String(index).padStart(5, '0')}`,
    customer_name: 'Cliente Preview Checkout QA', customer_email: RESERVED_CHECKOUT.email,
    customer_phone: '(11) 99999-0107', customer_cpf: RESERVED_CHECKOUT.cpf,
    color: 'glacier-blue', wheel_type: 'aero', optionals: [],
    payment_method: 'avista', total_price: '40000.00', status: 'APROVADO',
  };
}

type Options = {
  rows?: CheckoutRow[]; affectedDelta?: number; injectAfterDelete?: CheckoutRow;
  fail?: 'select' | 'delete' | 'commit' | 'unlock'; lockAvailable?: boolean;
};

// Real Kysely SQL compilation/lifecycle over an in-memory pg transport, never a socket.
// The emulator deliberately rejects any query outside the narrow checkout contract.
function setup(options: Options = {}) {
  let rows = structuredClone(options.rows ?? []);
  let snapshot: CheckoutRow[] | undefined;
  const statements: { sql: string; parameters: unknown[] }[] = [];
  const events: string[] = [];
  const query = vi.fn(async (statement: string, parameters: unknown[] = []) => {
    statements.push({ sql: statement, parameters });
    const result = (command: string, values: unknown[], count = values.length) => ({ command, rows: values, rowCount: count });
    if (statement.includes('pg_try_advisory_lock')) {
      events.push('lock');
      return result('SELECT', [{ acquired: options.lockAvailable !== false }]);
    }
    if (statement.includes('pg_advisory_unlock')) {
      events.push('unlock');
      if (options.fail === 'unlock') throw new Error(canary);
      return result('SELECT', [{ released: true }]);
    }
    if (statement === 'start transaction isolation level serializable') {
      events.push('begin'); snapshot = structuredClone(rows); return result('BEGIN', []);
    }
    if (statement === 'commit') {
      events.push('commit');
      if (options.fail === 'commit') throw new Error(canary);
      snapshot = undefined; return result('COMMIT', []);
    }
    if (statement === 'rollback') {
      events.push('rollback'); rows = snapshot ?? rows; snapshot = undefined; return result('ROLLBACK', []);
    }
    if (statement.startsWith('select ') && statement.includes('from "public"."orders"')) {
      events.push('select');
      if (options.fail === 'select') throw new Error(canary);
      expect(statement).toContain('where ("customer_cpf" = $1 or "customer_email" = $2) limit $3');
      expect(parameters).toEqual([RESERVED_CHECKOUT.cpf, RESERVED_CHECKOUT.email, MAX_CHECKOUT_ROWS + 1]);
      const candidates = rows.filter((row) => row.customer_cpf === parameters[0] || row.customer_email === parameters[1]);
      return result('SELECT', structuredClone(candidates.slice(0, Number(parameters[2]))));
    }
    if (statement.startsWith('delete from "public"."orders"')) {
      events.push('delete');
      if (options.fail === 'delete') throw new Error(canary);
      const ids = parameters.slice(0, -2);
      const [cpf, email] = parameters.slice(-2);
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
      expect(statement).toBe(`delete from "public"."orders" where "id" in (${placeholders}) and "customer_cpf" = $${ids.length + 1} and "customer_email" = $${ids.length + 2}`);
      expect([cpf, email]).toEqual([RESERVED_CHECKOUT.cpf, RESERVED_CHECKOUT.email]);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.length).toBeLessThanOrEqual(MAX_CHECKOUT_ROWS);
      const before = rows.length;
      rows = rows.filter((row) => !(ids.includes(row.id) && row.customer_cpf === cpf && row.customer_email === email));
      const count = before - rows.length;
      if (options.injectAfterDelete) rows.push(structuredClone(options.injectAfterDelete));
      return result('DELETE', [], count + (options.affectedDelta ?? 0));
    }
    throw new Error('Unexpected query in checkout-only in-memory transport.');
  });
  const client = { query, on: vi.fn(), release: vi.fn(() => { events.push('release'); }) };
  const pool = { on: vi.fn(), connect: vi.fn(async () => client),
    end: vi.fn(async () => { events.push('destroy'); }) };
  poolConstructor.mockImplementationOnce(function () { return pool; });
  return {
    events, statements,
    rows: () => structuredClone(rows),
    // Simulates a browser-created record; there is deliberately no SQL INSERT handler.
    browserCreates: (row: CheckoutRow) => { events.push('browser'); rows.push(structuredClone(row)); },
  };
}

describe('checkout reservation before Pool construction', () => {
  it('accepts a frozen synthetic fixture without reusing a lookup identity', () => {
    expect(Object.isFrozen(RESERVED_CHECKOUT)).toBe(true);
    expect(() => assertCheckoutFixture({ ...RESERVED_CHECKOUT })).not.toThrow();
    expect(RESERVED_ORDERS.map((row) => row.customer_email)).not.toContain(RESERVED_CHECKOUT.email);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it.each(Object.keys(RESERVED_CHECKOUT))('rejects a changed fixture field before Pool: %s', async (key) => {
    const use = vi.fn();
    await expect(withOwnedPreviewCheckout(environment(), marker, { ...RESERVED_CHECKOUT, [key]: 'unowned' }, use))
      .rejects.toThrow(/exact reservation/);
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...RESERVED_CHECKOUT, extra: true }])('rejects invalid/extra fixture shape: %#', async (fixture) => {
    await expect(withOwnedPreviewCheckout(environment(), marker, fixture, vi.fn())).rejects.toThrow(/exact reservation/);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('rejects inherited identity with an equal own-key count', async () => {
    const fixture = { ...RESERVED_CHECKOUT } as Record<string, unknown>;
    delete fixture.email;
    Object.setPrototypeOf(fixture, { email: RESERVED_CHECKOUT.email });
    fixture.extra = true;
    await expect(withOwnedPreviewCheckout(environment(), marker, fixture, vi.fn())).rejects.toThrow(/exact reservation/);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('validates the build marker before Pool even with a valid checkout fixture', async () => {
    await expect(withOwnedPreviewCheckout(environment(), { ...marker, environment: 'production' }, RESERVED_CHECKOUT, vi.fn()))
      .rejects.toThrow(/Deployment bloqueado/);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('rejects an accessor without invoking it or exposing its exception', async () => {
    const fixture = { ...RESERVED_CHECKOUT };
    const getter = vi.fn(() => { throw new Error(canary); });
    Object.defineProperty(fixture, 'email', { enumerable: true, get: getter });
    await expect(withOwnedPreviewCheckout(environment(), marker, fixture, vi.fn())).rejects.toThrow(/exact reservation/);
    expect(getter).not.toHaveBeenCalled();
    expect(poolConstructor).not.toHaveBeenCalled();
  });
});

describe('checkout ownership refuses partial identities and changed signatures', () => {
  it.each([
    { customer_cpf: '000.000.000-00' }, { customer_email: 'other@example.invalid' },
    { customer_name: 'Another customer' }, { customer_phone: '(11) 99999-0000' },
    { color: 'lunar-white' }, { wheel_type: 'sport' }, { optionals: ['precision-park'] },
    { optionals: null }, { payment_method: 'financiamento' }, { total_price: '40000.01' },
    { total_price: '4e4' }, { status: 'EM_ANALISE' }, { id: 'not-a-uuid' }, { order_number: 'arbitrary' },
  ])('rejects the entire transaction before DELETE: case %#', async (change) => {
    const before = [order(1), { ...order(2), ...change }];
    const db = setup({ rows: before });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout()))
      .rejects.toThrow(/ownership conflict/);
    expect(db.events).not.toContain('delete');
    expect(db.events).toContain('rollback');
    expect(db.rows()).toEqual(before);
  });

  it.each(['40000', '40000.0', '40000.00'])('accepts equivalent exact pg NUMERIC text %s', (total_price) => {
    expect(() => assertOwnedCheckoutRows([{ ...order(), total_price }])).not.toThrow();
  });

  it.each([
    { rows: [order(1), { ...order(2), id: order(1).id }] },
    { rows: [order(1), { ...order(2), order_number: order(1).order_number }] },
    { rows: Array.from({ length: MAX_CHECKOUT_ROWS + 1 }, (_, index) => order(index + 1)) },
  ])('rejects duplicates or overflow without a DELETE: case %#', async ({ rows }) => {
    const db = setup({ rows });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout()))
      .rejects.toThrow(/ownership conflict/);
    expect(db.events).not.toContain('delete');
  });

  it.each([
    { id: RESERVED_ORDERS[0].id }, { order_number: RESERVED_ORDERS[0].order_number },
  ])('never deletes a lookup reservation, even with checkout attributes: case %#', async (identity) => {
    const db = setup({ rows: [{ ...order(), ...identity }] });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout()))
      .rejects.toThrow(/reserved lookup/);
    expect(db.events).not.toContain('delete');
  });
});

describe('cleanup is committed before browser use, with retention after it', () => {
  it('starts empty without DELETE/INSERT, commits absence, then retains the browser order after unlock', async () => {
    const db = setup();
    await withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, async (sql) => {
      expect(await sql.prepareCheckout()).toEqual({ deletedBeforeCheckout: 0, deletedOrders: [], absentBeforeCheckout: true });
      expect(db.events[db.events.length - 1]).toBe('commit');
      db.browserCreates(order());
      expect(await sql.readCheckout()).toEqual(order());
      expect(db.events).not.toContain('unlock');
    });
    expect(db.rows()).toEqual([order()]);
    expect(db.events).toEqual(['lock', 'begin', 'select', 'select', 'commit', 'browser', 'select', 'unlock', 'release', 'destroy']);
    expect(db.statements.some(({ sql }) => sql.startsWith('insert ') || sql.startsWith('delete '))).toBe(false);
  });

  it('deletes only observed IDs AND exact CPF/email, leaves unrelated rows and retains the next order', async () => {
    const unrelated = { ...order(9), customer_cpf: '000.000.000-00', customer_email: 'unrelated@example.invalid' };
    const db = setup({ rows: [order(1), order(2), unrelated] });
    await withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, async (sql) => {
      const first = await sql.prepareCheckout();
      expect(first.deletedBeforeCheckout).toBe(2);
      expect(first.deletedOrders).toEqual([1, 2].map((index) => ({ id: order(index).id, order_number: order(index).order_number })));
      expect(db.rows()).toEqual([unrelated]);
      db.browserCreates(order(3));
      expect((await sql.readCheckout()).id).toBe(order(3).id);
      expect((await sql.prepareCheckout()).deletedBeforeCheckout).toBe(1);
      db.browserCreates(order(4));
      expect((await sql.readCheckout()).id).toBe(order(4).id);
    });
    expect(db.rows()).toEqual([unrelated, order(4)]);
    expect(db.statements.filter(({ sql }) => sql.endsWith('for update'))).toHaveLength(2);
    expect(db.statements.filter(({ sql }) => sql.startsWith('delete '))).toHaveLength(2);
  });

  it.each([-1, 1])('rolls back a deletion count mismatch (%s)', async (affectedDelta) => {
    const db = setup({ rows: [order()], affectedDelta });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout()))
      .rejects.toThrow(/deletion count/);
    expect(db.events).toContain('rollback');
    expect(db.rows()).toEqual([order()]);
  });

  it('rolls back if the post-delete absence check finds a candidate', async () => {
    const db = setup({ rows: [order()], injectAfterDelete: order(2) });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout()))
      .rejects.toThrow(/not absent/);
    expect(db.events).toContain('rollback');
    expect(db.rows()).toEqual([order()]);
  });

  it.each([{ rows: [] }, { rows: [order(1), order(2)] }])('requires exactly one retained order, not just a matching subset: %#', async ({ rows }) => {
    const db = setup({ rows });
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.readCheckout()))
      .rejects.toThrow(/exactly one/);
    expect(db.events).not.toContain('delete');
  });

  it('does not turn a later read conflict into another cleanup', async () => {
    const db = setup();
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, async (sql) => {
      await sql.prepareCheckout();
      db.browserCreates({ ...order(), customer_name: 'Changed outside the suite' });
      await sql.readCheckout();
    })).rejects.toThrow(/ownership conflict/);
    expect(db.rows()).toHaveLength(1);
    expect(db.events).not.toContain('delete');
  });

  it('retains browser data and the original UI failure even when unlock fails', async () => {
    const db = setup({ fail: 'unlock' });
    const original = new Error('Original UI failure');
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, async (sql) => {
      await sql.prepareCheckout(); db.browserCreates(order()); throw original;
    })).rejects.toBe(original);
    expect(db.rows()).toEqual([order()]);
    expect(db.events.slice(-3)).toEqual(['unlock', 'release', 'destroy']);
  });

  it.each(['select', 'delete', 'commit'] as const)('sanitizes a driver failure in %s and does not report success', async (fail) => {
    const db = setup({ rows: [order()], fail });
    const operation = withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (sql) => sql.prepareCheckout());
    await expect(operation).rejects.toThrow(/driver details and credentials omitted/);
    await expect(operation).rejects.not.toThrow(canary);
    await expect(operation).rejects.not.toHaveProperty('cause');
    expect(db.rows()).toEqual([order()]);
  });

  it('cannot begin preparation without the existing suite lock', async () => {
    const db = setup({ rows: [order()], lockAvailable: false });
    const use = vi.fn();
    await expect(withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, use)).rejects.toThrow(/Another process owns/);
    expect(use).not.toHaveBeenCalled();
    expect(db.events).toEqual(['lock', 'release', 'destroy']);
    expect(db.rows()).toEqual([order()]);
  });
});
