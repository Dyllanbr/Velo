import { describe, expect, it, vi } from 'vitest';
import { assertOwnedRows, DATABASE_PREVIEW_REF, isAllowedPreviewOrdersRead, previewDatabaseSettings, RESERVED_ORDERS, RESERVED_ORDER_DETAILS, reservedOrderDetailsFromJson, toOwnedOrderInsert, withOwnedPreviewDatabase, type PreviewOrderDetails } from '../../playwright/support/preview-database';
import { KNOWN_PRODUCTION_REF } from './preview-safety';
import testData from '../../playwright/support/fixtures/orders.preview.json' with { type: 'json' };

const poolConstructor = vi.hoisted(() => vi.fn<() => unknown>(() => {
  throw new Error('Unexpected Pool construction in guard-only tests.');
}));
vi.mock('pg', () => ({ Pool: poolConstructor }));

function environment() {
  return {
    E2E_PREVIEW_ALLOWED: 'true', E2E_PREVIEW_DATABASE_ALLOWED: 'true',
    PREVIEW_SUPABASE_PROJECT_REF: DATABASE_PREVIEW_REF,
    PREVIEW_SUPABASE_URL: `https://${DATABASE_PREVIEW_REF}.supabase.co`,
    PREVIEW_SUPABASE_ANON_KEY: 'sb_publishable_fixture_preview',
    PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
    PRODUCTION_SUPABASE_URL: `https://${KNOWN_PRODUCTION_REF}.supabase.co`,
    PRODUCTION_SUPABASE_ANON_KEY: 'sb_publishable_fixture_production',
    E2E_BASE_URL: 'https://fixture-only.vercel.app', E2E_EXPECTED_SHA: 'a'.repeat(40),
    TEST_DATABASE_URL: `postgresql://postgres:fixture-password@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
  };
}

describe('preview SQL configuration before opening a pool', () => {
  it('uses explicit destination and verified TLS, without connection-string options', () => {
    const settings = previewDatabaseSettings(environment());
    expect(settings.pool).toMatchObject({ host: `db.${DATABASE_PREVIEW_REF}.supabase.co`,
      port: 5432, database: 'postgres', user: 'postgres', ssl: { rejectUnauthorized: true }, max: 1 });
    expect(settings.pool).not.toHaveProperty('connectionString');
  });

  it('requires the additional database opt-in', () => {
    expect(() => previewDatabaseSettings({ ...environment(), E2E_PREVIEW_DATABASE_ALLOWED: 'false' })).toThrow(/opt-in/);
  });

  it.each(['PGHOST', 'PGPASSWORD', 'PGOPTIONS', 'PGSSLMODE', 'PGREPLICATION', 'PGBINARY', 'pgbinary'])('rejects ambient %s', (name) => {
    expect(() => previewDatabaseSettings({ ...environment(), [name]: 'untrusted-fixture' })).toThrow(/Ambient PG/);
  });

  it('rejects a process that explicitly disables TLS verification', () => {
    expect(() => previewDatabaseSettings({ ...environment(), NODE_TLS_REJECT_UNAUTHORIZED: '0' })).toThrow(/disabled TLS/);
  });

  it('does not accept another non-production project', () => {
    const ref = 'x'.repeat(20);
    expect(() => previewDatabaseSettings({ ...environment(), PREVIEW_SUPABASE_PROJECT_REF: ref,
      PREVIEW_SUPABASE_URL: `https://${ref}.supabase.co` })).toThrow(/reserved preview/);
  });

  it.each([
    `postgresql://postgres:fake@db.${KNOWN_PRODUCTION_REF}.supabase.co:5432/postgres`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co.evil.invalid:5432/postgres`,
    'postgresql://postgres:fake@127.0.0.1:5432/postgres',
    `postgresql://postgres.${DATABASE_PREVIEW_REF}:fake@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${DATABASE_PREVIEW_REF}:fake@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5433/postgres`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/other`,
    `postgresql://other:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
    `postgresql://postgres@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres?sslmode=disable`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres?host=elsewhere`,
    `postgresql://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres#anything`,
    `https://postgres:fake@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
    '',
  ])('rejects an unapproved database destination/options: case %#', (url) => {
    expect(() => previewDatabaseSettings({ ...environment(), TEST_DATABASE_URL: url })).toThrow(/exact direct preview endpoint/);
  });

  it('does not emit a malformed URL/password in its error', () => {
    const secret = 'unit-canary-that-must-not-appear';
    try { previewDatabaseSettings({ ...environment(), TEST_DATABASE_URL: `${secret}%%%` }); }
    catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
      expect(error).not.toHaveProperty('cause');
      return;
    }
    throw new Error('Expected configuration rejection.');
  });

  it.each([
    { environment: 'production', supabaseProjectRef: DATABASE_PREVIEW_REF, sha: 'a'.repeat(40) },
    { environment: 'preview', supabaseProjectRef: KNOWN_PRODUCTION_REF, sha: 'a'.repeat(40) },
    { environment: 'preview', supabaseProjectRef: DATABASE_PREVIEW_REF, sha: 'b'.repeat(40) },
  ])('rejects a mismatching marker before Pool construction: case %#', async (marker) => {
    poolConstructor.mockClear();
    const use = vi.fn();
    await expect(withOwnedPreviewDatabase(environment(), marker, use)).rejects.toThrow(/Deployment bloqueado/);
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
  });
});

describe('reserved SQL ownership', () => {
  it('accepts empty or exact owned subsets; status may be reset by preparation', () => {
    expect(() => assertOwnedRows([])).not.toThrow();
    expect(() => assertOwnedRows(RESERVED_ORDERS)).not.toThrow();
    expect(() => assertOwnedRows([{ ...RESERVED_ORDERS[0], status: 'unexpected-old-status' }])).not.toThrow();
  });

  it.each([
    { ...RESERVED_ORDERS[0], id: '0'.repeat(36) },
    { ...RESERVED_ORDERS[0], order_number: 'VLO-ALIENO' },
    { ...RESERVED_ORDERS[0], customer_email: 'somebody-else@example.invalid' },
    { ...RESERVED_ORDERS[0], id: RESERVED_ORDERS[1].id },
  ])('rejects an identity collision even if other fields match: case %#', (row) => {
    expect(() => assertOwnedRows([row])).toThrow(/no deletion/);
  });

  it('rejects duplicate rows and does not silently deduplicate evidence', () => {
    expect(() => assertOwnedRows([RESERVED_ORDERS[0], RESERVED_ORDERS[0]])).toThrow(/duplicate/);
  });
});

describe('browser access to seeded rows is read only', () => {
  const origin = `https://${DATABASE_PREVIEW_REF}.supabase.co`;
  const target = `${origin}/rest/v1/orders?select=*&order_number=eq.${RESERVED_ORDERS[0].order_number}`;

  it('allows the exact owned GET and its GET preflight', () => {
    expect(isAllowedPreviewOrdersRead({ url: target, method: 'GET' }, origin)).toBe(true);
    expect(isAllowedPreviewOrdersRead({ url: target, method: 'OPTIONS', preflightMethod: 'GET' }, origin)).toBe(true);
  });

  it.each(['POST', 'PATCH', 'DELETE', 'HEAD'])('rejects %s', (method) => {
    expect(isAllowedPreviewOrdersRead({ url: target, method }, origin)).toBe(false);
  });

  it.each([
    target.replace(DATABASE_PREVIEW_REF, KNOWN_PRODUCTION_REF),
    target.replace('/orders?', '/customers?'),
    target.replace(RESERVED_ORDERS[0].order_number, 'VLO-ALIENO'),
    `${target}&order_number=eq.${RESERVED_ORDERS[1].order_number}`,
    `${target}&limit=1`, `${target}#fragment`,
    target.replace('https://', 'https://user:pass@'),
    target.replace(`://${DATABASE_PREVIEW_REF}.supabase.co`, `://${DATABASE_PREVIEW_REF}.supabase.co.evil.invalid`),
  ])('rejects unrelated rows/origins or extra filters: case %#', (url) => {
    expect(isAllowedPreviewOrdersRead({ url, method: 'GET' }, origin)).toBe(false);
  });

  it('does not authorize a write preflight', () => {
    expect(isAllowedPreviewOrdersRead({ url: target, method: 'OPTIONS', preflightMethod: 'POST' }, origin)).toBe(false);
  });
});

describe('UI-shaped reserved orders map to SQL without duplicating scenario data', () => {
  const order = RESERVED_ORDER_DETAILS[0];

  it.each(RESERVED_ORDER_DETAILS)('maps the full $status scenario and retains its ownership identity', (scenario) => {
    const owner = RESERVED_ORDERS.find((candidate) => candidate.status === scenario.status);
    expect(toOwnedOrderInsert(scenario)).toEqual({
      ...owner, color: 'glacier-blue', wheel_type: 'aero',
      customer_name: `Cliente QA M4 ${scenario.status}`, customer_phone: '(11) 99999-0000',
      customer_cpf: '000.000.000-00', payment_method: 'avista', total_price: '40000', optionals: [],
    });
    expect(scenario.price).toBe('R$ 40.000,00');
  });

  it.each([
    ['Glacier Blue', 'glacier-blue'], ['Midnight Black', 'midnight-black'], ['Lunar White', 'lunar-white'],
  ])('converts the display color %s to its stored code', (color, stored) => {
    expect(toOwnedOrderInsert({ ...order, color }).color).toBe(stored);
  });

  it.each([['aero Wheels', 'aero'], ['Sport Wheels', 'sport']])(
    'removes the case-sensitive display suffix before lowercasing %s', (wheels, stored) => {
      expect(toOwnedOrderInsert({ ...order, wheels }).wheel_type).toBe(stored);
    },
  );

  it.each(['À Vista', 'À VISTA'])('normalizes the accented cash payment %s', (payment) => {
    expect(toOwnedOrderInsert({ ...order, payment }).payment_method).toBe('avista');
  });

  it.each([
    { ...order, number: 'VLO-UNOWNED' },
    { ...order, number: RESERVED_ORDERS[1].order_number },
    { ...order, customer: { ...order.customer, email: 'unowned@example.invalid' } },
    { ...order, status: 'REPROVADO' },
    { ...order, status: 'pending' },
  ])('rejects a mismatched reserved scenario before mapping: case %#', (invalid) => {
    expect(() => toOwnedOrderInsert(invalid as PreviewOrderDetails)).toThrow(/exact reserved scenario/);
  });

  it.each([
    { ...order, color: 'Red' }, { ...order, wheels: 'aero wheels' },
    { ...order, wheels: 'Unknown Wheels' }, { ...order, payment: 'Financiamento' },
  ])('rejects an unsupported converted business value: case %#', (invalid) => {
    expect(() => toOwnedOrderInsert(invalid)).toThrow(/unsupported color, wheels or payment/);
  });

  it.each(['', '-1', '4e4', '40000,00', '40000.001', 'Infinity', '9007199254740992'])(
    'rejects an invalid decimal or unsafe precision: case %#', (total_price) => {
      expect(() => toOwnedOrderInsert({ ...order, total_price })).toThrow(/Fixture total/);
    },
  );

  it('rejects a displayed price that differs from the SQL decimal', () => {
    expect(() => toOwnedOrderInsert({ ...order, price: 'R$ 42.000,00' })).toThrow(/displayed price/);
  });

  it('preserves decimal cents rather than parsing the formatted UI price into SQL', () => {
    const payload = toOwnedOrderInsert({ ...order, total_price: '40000.50', price: 'R$ 40.000,50' });
    expect(payload.total_price).toBe('40000.50');
  });

  it('uses the reserved UUID, leaves generated timestamps absent and does not mutate its input', () => {
    const input = Object.freeze({ ...order, id: 'cannot-select-another-uuid' });
    const before = structuredClone(input);
    const payload = toOwnedOrderInsert(input);
    expect(payload.id).toBe(RESERVED_ORDERS[0].id);
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(input).toEqual(before);
  });

  it('does not open a Pool while mapping a fixture', () => {
    const callsBefore = poolConstructor.mock.calls.length;
    toOwnedOrderInsert(order);
    expect(poolConstructor.mock.calls).toHaveLength(callsBefore);
  });
});

describe('external JSON contains only the three authorized scenario datasets', () => {
  it('loads the three scenarios in reserved order with frozen objects and derived prices, without a Pool', () => {
    const callsBefore = poolConstructor.mock.calls.length;
    const orders = reservedOrderDetailsFromJson(testData);
    expect(orders).toEqual(RESERVED_ORDER_DETAILS);
    expect(orders.map((order) => order.status)).toEqual(['APROVADO', 'REPROVADO', 'EM_ANALISE']);
    expect(Object.isFrozen(orders)).toBe(true);
    expect(orders.every((order) => Object.isFrozen(order) && Object.isFrozen(order.customer))).toBe(true);
    expect(poolConstructor.mock.calls).toHaveLength(callsBefore);
  });

  it.each([
    null, [], {}, { aprovado: testData.aprovado, reprovado: testData.reprovado },
    { ...testData, extra: testData.aprovado },
  ])('rejects missing, extra or invalid scenario containers before a Pool: case %#', (invalid) => {
    const callsBefore = poolConstructor.mock.calls.length;
    expect(() => reservedOrderDetailsFromJson(invalid)).toThrow(/exactly the three reserved/);
    expect(poolConstructor.mock.calls).toHaveLength(callsBefore);
  });

  it.each([
    Object.fromEntries(Object.entries(testData.aprovado).filter(([field]) => field !== 'number')),
    { ...testData.aprovado, color: 7 },
    { ...testData.aprovado, customer: null },
    { ...testData.aprovado, customer: [] },
    { ...testData.aprovado, customer: { ...testData.aprovado.customer, name: '' } },
    { ...testData.aprovado, customer: { ...testData.aprovado.customer, phone: 123 } },
    { ...testData.aprovado, total_price: 40000 },
  ])('rejects missing or incorrectly typed fields without printing data: case %#', (invalid) => {
    const callsBefore = poolConstructor.mock.calls.length;
    const input = { ...testData, aprovado: invalid };
    expect(() => reservedOrderDetailsFromJson(input)).toThrow('Fixture JSON has missing, unexpected or invalid fields; values omitted.');
    expect(poolConstructor.mock.calls).toHaveLength(callsBefore);
  });

  it.each(['price', 'id', 'created_at'])('does not let JSON supply the derived/reserved/generated field %s', (field) => {
    const invalid = { ...testData, aprovado: { ...testData.aprovado, [field]: 'forbidden-fixture-value' } };
    expect(() => reservedOrderDetailsFromJson(invalid)).toThrow(/unexpected or invalid fields/);
  });

  it.each([
    { ...testData.aprovado, status: 'REPROVADO' },
    { ...testData.aprovado, number: testData.reprovado.number },
    { ...testData.aprovado, customer: { ...testData.aprovado.customer, email: 'unowned@example.invalid' } },
  ])('checks JSON identity against the independent reserved registry: case %#', (invalid) => {
    expect(() => reservedOrderDetailsFromJson({ ...testData, aprovado: invalid }))
      .toThrow(/scenario\/status does not match|exact reserved scenario/);
  });

  it('carries an allowed JSON attribute change into both the UI object and SQL payload', () => {
    const input = structuredClone(testData);
    input.aprovado.color = 'Lunar White';
    input.aprovado.total_price = '40000.50';
    const [order] = reservedOrderDetailsFromJson(input);
    expect(order.color).toBe('Lunar White');
    expect(order.price).toBe('R$ 40.000,50');
    expect(toOwnedOrderInsert(order)).toMatchObject({ color: 'lunar-white', total_price: '40000.50' });
  });

  it('does not freeze or mutate the imported JSON when constructing isolated scenario objects', () => {
    const input = structuredClone(testData);
    const before = structuredClone(input);
    const [order] = reservedOrderDetailsFromJson(input);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.aprovado)).toBe(false);
    expect(order).not.toBe(input.aprovado);
    expect(order.customer).not.toBe(input.aprovado.customer);
  });
});

describe('preview SQL cleanup preserves the original failure', () => {
  const marker = { environment: 'preview', supabaseProjectRef: DATABASE_PREVIEW_REF, sha: 'a'.repeat(40) };
  const driverCanary = 'private-driver-details-must-not-escape';
  type Failures = {
    connect?: boolean; lock?: 'unavailable' | 'throws';
    unlock?: 'false' | 'throws'; release?: boolean; destroy?: boolean;
  };

  // Exercise the real Kysely lifecycle with an in-memory pg transport, never a socket.
  function setup(failures: Failures = {}) {
    const events: string[] = [];
    const client = {
      query: vi.fn(async (query: string) => {
        if (query.includes('pg_try_advisory_lock')) {
          events.push('lock');
          if (failures.lock === 'throws') throw new Error(driverCanary);
          return { command: 'SELECT', rowCount: 1, rows: [{ acquired: failures.lock !== 'unavailable' }] };
        }
        if (query.includes('pg_advisory_unlock')) {
          events.push('unlock');
          if (failures.unlock === 'throws') throw new Error(driverCanary);
          return { command: 'SELECT', rowCount: 1, rows: [{ released: failures.unlock !== 'false' }] };
        }
        throw new Error('Unexpected SQL in cleanup-only unit test.');
      }),
      release: vi.fn(() => {
        events.push('release');
        if (failures.release) throw new Error(driverCanary);
      }),
    };
    const pool = {
      on: vi.fn(),
      connect: vi.fn(async () => {
        events.push('connect');
        if (failures.connect) throw new Error(driverCanary);
        return client;
      }),
      end: vi.fn(async () => {
        events.push('destroy');
        if (failures.destroy) throw new Error(driverCanary);
      }),
    };
    poolConstructor.mockImplementationOnce(function () { return pool; });
    return { events, query: client.query };
  }

  it.each([
    { ...RESERVED_ORDER_DETAILS[0], number: 'VLO-UNOWNED' },
    { ...RESERVED_ORDER_DETAILS[0], wheels: 'aero wheels' },
  ])('rejects invalid fixture data before BEGIN or DELETE: case %#', async (invalid) => {
    const { events, query } = setup();
    await expect(withOwnedPreviewDatabase(environment(), marker, (database) => database.prepare(invalid)))
      .rejects.toThrow(/exact reserved scenario|unsupported color, wheels or payment/);
    expect(events).toEqual(['connect', 'lock', 'unlock', 'release', 'destroy']);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([statement]) => statement.includes('pg_try_advisory_lock')
      || statement.includes('pg_advisory_unlock'))).toBe(true);
  });

  it('returns the callback value only after unlocking, releasing and destroying', async () => {
    const { events } = setup();
    const result = { passed: true };
    await expect(withOwnedPreviewDatabase(environment(), marker, async () => {
      events.push('use');
      return result;
    })).resolves.toBe(result);
    expect(events).toEqual(['connect', 'lock', 'use', 'unlock', 'release', 'destroy']);
  });

  it.each<Failures>([
    {}, { unlock: 'throws' }, { unlock: 'false' }, { release: true }, { destroy: true },
    { unlock: 'throws', release: true, destroy: true },
  ])('preserves the exact callback error despite cleanup failures: case %#', async (failures) => {
    const { events } = setup(failures);
    const assertionFailure = new Error('Original UI assertion failure.');
    await expect(withOwnedPreviewDatabase(environment(), marker, async () => {
      events.push('use');
      throw assertionFailure;
    })).rejects.toBe(assertionFailure);
    expect(events).toEqual(['connect', 'lock', 'use', 'unlock', 'release', 'destroy']);
  });

  it('preserves even an undefined rejection instead of treating it as success', async () => {
    const { events } = setup({ unlock: 'throws', destroy: true });
    await expect(withOwnedPreviewDatabase(environment(), marker, () => Promise.reject(undefined))).rejects.toBeUndefined();
    expect(events).toEqual(['connect', 'lock', 'unlock', 'release', 'destroy']);
  });

  it.each<Failures>([
    { unlock: 'throws' }, { unlock: 'false' }, { release: true }, { destroy: true },
  ])('fails a successful callback if cleanup fails, without driver details: case %#', async (failures) => {
    const { events } = setup(failures);
    const result = withOwnedPreviewDatabase(environment(), marker, async () => 'success');
    await expect(result).rejects.toThrow(/omitted|lock release failed/);
    await expect(result).rejects.not.toThrow(driverCanary);
    await expect(result).rejects.not.toHaveProperty('cause');
    expect(events).toEqual(['connect', 'lock', 'unlock', 'release', 'destroy']);
  });

  it.each<Failures>([{ connect: true }, { lock: 'throws' }, { lock: 'unavailable' }])(
    'does not use or unlock a session whose lock was not acquired: case %#', async (failures) => {
      const { events } = setup(failures);
      const use = vi.fn();
      const result = withOwnedPreviewDatabase(environment(), marker, use);
      await expect(result).rejects.toThrow(/omitted|Another process owns/);
      await expect(result).rejects.not.toThrow(driverCanary);
      expect(use).not.toHaveBeenCalled();
      expect(events).toEqual(failures.connect ? ['connect', 'destroy'] : ['connect', 'lock', 'release', 'destroy']);
    },
  );
});
