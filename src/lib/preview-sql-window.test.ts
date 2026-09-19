import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_PREVIEW_REF, RESERVED_ORDER_DETAILS, RESERVED_ORDERS,
  withOwnedPreviewDatabase, withOwnedPreviewCheckout } from '../../playwright/support/preview-database';
import { RESERVED_CHECKOUT } from '../../playwright/support/preview-checkout';
import { createPreviewOperationWindow } from '../../playwright/support/preview-operation-window';
import { KNOWN_PRODUCTION_REF } from './preview-safety';

const poolConstructor = vi.hoisted(() => vi.fn<() => unknown>());
vi.mock('pg', () => ({ Pool: poolConstructor }));
beforeEach(() => poolConstructor.mockReset());
const marker = { environment: 'preview', supabaseProjectRef: DATABASE_PREVIEW_REF, sha: 'a'.repeat(40) };
const environment = () => ({
  E2E_PREVIEW_ALLOWED: 'true', E2E_PREVIEW_DATABASE_ALLOWED: 'true',
  PREVIEW_SUPABASE_PROJECT_REF: DATABASE_PREVIEW_REF,
  PREVIEW_SUPABASE_URL: `https://${DATABASE_PREVIEW_REF}.supabase.co`,
  PREVIEW_SUPABASE_ANON_KEY: 'sb_publishable_fixture_preview',
  PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_REF,
  PRODUCTION_SUPABASE_URL: `https://${KNOWN_PRODUCTION_REF}.supabase.co`,
  PRODUCTION_SUPABASE_ANON_KEY: 'sb_publishable_fixture_production',
  E2E_BASE_URL: 'https://fixture-only.vercel.app', E2E_EXPECTED_SHA: 'a'.repeat(40),
  TEST_DATABASE_URL: `postgresql://postgres:fixture-password@db.${DATABASE_PREVIEW_REF}.supabase.co:5432/postgres`,
});
const ownedCheckout = {
  id: '00000000-0000-4000-8000-000000000001', order_number: 'VLO-T00001',
  customer_name: `${RESERVED_CHECKOUT.name} ${RESERVED_CHECKOUT.surname}`,
  customer_email: RESERVED_CHECKOUT.email, customer_phone: RESERVED_CHECKOUT.phone,
  customer_cpf: RESERVED_CHECKOUT.cpf, color: 'glacier-blue', wheel_type: 'aero', optionals: [],
  payment_method: 'avista', total_price: '40000.00', status: 'APROVADO',
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
type Pause = 'connect' | 'lock' | 'select' | 'delete' | 'insert' | 'absence';

// Real Kysely/PostgresDriver compilation over an in-memory pg transport. No socket.
function setup(kind: 'lookup' | 'checkout', pause?: Pause) {
  const entered = deferred();
  const release = deferred();
  const events: string[] = [];
  let deleted = false;
  let inserted = false;
  const stop = async (point: Pause) => {
    if (point === pause) { entered.resolve(); await release.promise; }
  };
  const query = vi.fn(async (statement: string) => {
    const result = (command: string, rows: unknown[], rowCount = rows.length) => ({ command, rows, rowCount });
    if (statement.includes('pg_try_advisory_lock')) {
      events.push('lock'); await stop('lock'); return result('SELECT', [{ acquired: true }]);
    }
    if (statement.includes('pg_advisory_unlock')) {
      events.push('unlock'); return result('SELECT', [{ released: true }]);
    }
    if (statement === 'begin' || statement === 'start transaction isolation level serializable') {
      events.push('begin'); return result('BEGIN', []);
    }
    if (statement === 'rollback') {
      events.push('rollback'); deleted = false; inserted = false; return result('ROLLBACK', []);
    }
    if (statement === 'commit') { events.push('commit'); return result('COMMIT', []); }
    if (statement.startsWith('select ') && statement.includes('from "public"."orders"')) {
      const point = kind === 'checkout' && deleted ? 'absence' : 'select';
      events.push(point); await stop(point);
      return result('SELECT', kind === 'checkout' && !deleted ? [ownedCheckout] : []);
    }
    if (statement.startsWith('delete from "public"."orders"')) {
      events.push('delete'); deleted = true; await stop('delete');
      return result('DELETE', [], kind === 'checkout' ? 1 : 0);
    }
    if (kind === 'lookup' && statement.startsWith('insert into "public"."orders"')) {
      events.push('insert'); inserted = true; await stop('insert');
      return result('INSERT', [RESERVED_ORDERS[0]], 1);
    }
    throw new Error('Unexpected SQL in the in-memory admission test.');
  });
  const client = { query, on: vi.fn(), release: vi.fn(() => { events.push('release'); }) };
  const pool = { on: vi.fn(),
    connect: vi.fn(async () => { events.push('connect'); await stop('connect'); return client; }),
    end: vi.fn(async () => { events.push('destroy'); }),
  };
  poolConstructor.mockImplementationOnce(function () { return pool; });
  return { entered, release, events, state: () => ({ deleted, inserted }) };
}

function run(kind: 'lookup' | 'checkout', assertActive: () => void) {
  return kind === 'lookup'
    ? withOwnedPreviewDatabase(environment(), marker, (db) => db.prepare(RESERVED_ORDER_DETAILS[0]), assertActive)
    : withOwnedPreviewCheckout(environment(), marker, RESERVED_CHECKOUT, (db) => db.prepareCheckout(), assertActive);
}

describe('late native SQL continuations cannot start a new statement', () => {
  it.each(['lookup', 'checkout'] as const)('control: active %s can commit and then clean up', async (kind) => {
    const transport = setup(kind);
    const gate = createPreviewOperationWindow(100, () => 0);
    await run(kind, gate.assertActive);
    expect(transport.events).toContain('commit');
    expect(transport.events).not.toContain('rollback');
    expect(transport.events.slice(-3)).toEqual(['unlock', 'release', 'destroy']);
  });

  const scenarios = [
    { kind: 'lookup' as const, point: 'connect' as const, forbidden: ['lock', 'begin', 'delete', 'insert', 'commit'] },
    { kind: 'checkout' as const, point: 'connect' as const, forbidden: ['lock', 'begin', 'delete', 'commit'] },
    { kind: 'lookup' as const, point: 'lock' as const, forbidden: ['begin', 'delete', 'insert', 'commit'] },
    { kind: 'checkout' as const, point: 'lock' as const, forbidden: ['begin', 'delete', 'commit'] },
    { kind: 'lookup' as const, point: 'select' as const, forbidden: ['delete', 'insert', 'commit'] },
    { kind: 'checkout' as const, point: 'select' as const, forbidden: ['delete', 'commit'] },
    { kind: 'lookup' as const, point: 'delete' as const, forbidden: ['insert', 'commit'] },
    { kind: 'lookup' as const, point: 'insert' as const, forbidden: ['commit'] },
    { kind: 'checkout' as const, point: 'absence' as const, forbidden: ['commit'] },
  ];
  for (const mode of ['close', 'deadline'] as const) {
    it.each(scenarios)(`${mode}: $kind pending $point blocks its next statement but permits cleanup`, async ({ kind, point, forbidden }) => {
      let now = 0;
      const gate = createPreviewOperationWindow(100, () => now);
      const transport = setup(kind, point);
      const pending = run(kind, gate.assertActive);
      // Attach rejection handler before releasing the pending native operation.
      const failure = expect(pending).rejects.toThrow(/window ended|database.*failed/);
      await transport.entered.promise;
      if (mode === 'close') gate.close(); else now = 100;
      transport.release.resolve();
      await failure;
      for (const operation of forbidden) expect(transport.events).not.toContain(operation);
      if (transport.events.includes('begin')) expect(transport.events).toContain('rollback');
      if (point !== 'connect') expect(transport.events).toContain('unlock');
      expect(transport.events.slice(-2)).toEqual(['release', 'destroy']);
      expect(transport.state()).toEqual({ deleted: false, inserted: false });
      expect(gate.assertActive).toThrow(/window ended/);
    });
  }
});
