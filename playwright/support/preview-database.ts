import { Kysely, PostgresDialect, sql, type Generated, type Insertable } from 'kysely';
import { Pool, type PoolConfig } from 'pg';
import { guardPreviewDriver } from './guarded-preview-driver';
import { createPreviewOperationWindow } from './preview-operation-window';
import { assertPreviewBuild, previewSettings } from '../../src/lib/preview-safety';
import type { OrderDetails } from './actions/orderLookupActions';
import testData from './fixtures/orders.preview.json' with { type: 'json' };

import { assertCheckoutFixture, assertOwnedCheckoutRows, MAX_CHECKOUT_ROWS,
  RESERVED_CHECKOUT, type CheckoutRow } from './preview-checkout';

export const DATABASE_PREVIEW_REF = 'bcsepghyrzmabmmdinuy';
const LOCK_NAMESPACE = 1704192026;
const LOCK_SUITE = 234032019;

// Reserved for this suite, never copied from an existing customer record.
// Stable UUIDs add ownership checks to the lesson's stable business codes.
export const RESERVED_ORDERS = Object.freeze([
  Object.freeze({ id: '37ccadc3-93fa-4605-a995-c3638f4aff96', order_number: 'VLO-QA4A01',
    customer_email: 'qa-m4-37ccadc3-93fa-4605-a995-c3638f4aff96@example.invalid', status: 'APROVADO' as const }),
  Object.freeze({ id: 'ad6303db-c066-4be2-8a6a-8715233dca80', order_number: 'VLO-QA4A02',
    customer_email: 'qa-m4-ad6303db-c066-4be2-8a6a-8715233dca80@example.invalid', status: 'REPROVADO' as const }),
  Object.freeze({ id: 'f8a3c25e-cdf0-493c-905e-689648803d46', order_number: 'VLO-QA4A03',
    customer_email: 'qa-m4-f8a3c25e-cdf0-493c-905e-689648803d46@example.invalid', status: 'EM_ANALISE' as const }),
]);

type Environment = Record<string, string | undefined>;
type Scenario = typeof RESERVED_ORDERS[number];
export type PreviewOrderDetails = Omit<OrderDetails, 'status' | 'customer'> & {
  status: Scenario['status'];
  customer: OrderDetails['customer'] & { document: string; phone: string };
  total_price: string;
};
type OwnedRow = { id: string; order_number: string; customer_email: string; status: string };
interface OrdersTable extends OwnedRow {
  color: string;
  wheel_type: string;
  customer_name: string;
  customer_phone: string;
  customer_cpf: string;
  payment_method: string;
  // pg's default NUMERIC parser returns strings, unlike the PostgREST DTO.
  total_price: string;
  optionals: string[] | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}
interface Database { orders: OrdersTable }

class DatabaseGuardError extends Error {}

function displayPrice(total: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(total)) {
    throw new DatabaseGuardError('Fixture total must be a non-negative decimal with at most two fraction digits.');
  }
  const [whole, fraction = ''] = total.split('.');
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`);
  if (!Number.isSafeInteger(cents)) {
    throw new DatabaseGuardError('Fixture total exceeds safe currency formatting precision.');
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100).replace(/\u00a0/g, ' ');
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function reservedOrderDetailsFromJson(data: unknown): readonly PreviewOrderDetails[] {
  const keys = ['aprovado', 'reprovado', 'em_analise'] as const;
  if (!hasExactKeys(data, keys)) throw new DatabaseGuardError('Fixture JSON must contain exactly the three reserved scenarios.');
  const fields = ['number', 'status', 'color', 'wheels', 'payment', 'total_price'] as const;
  const customerFields = ['name', 'email', 'phone', 'document'] as const;
  const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  return Object.freeze(keys.map((key, index) => {
    const entry = data[key];
    if (!hasExactKeys(entry, [...fields, 'customer']) || !fields.every((field) => isText(entry[field]))) {
      throw new DatabaseGuardError('Fixture JSON has missing, unexpected or invalid fields; values omitted.');
    }
    const customer = entry.customer;
    if (!hasExactKeys(customer, customerFields) || !customerFields.every((field) => isText(customer[field]))) {
      throw new DatabaseGuardError('Fixture JSON has missing, unexpected or invalid fields; values omitted.');
    }
    // This assertion follows executable shape checks; it is not the validator.
    const raw = entry as Omit<PreviewOrderDetails, 'price' | 'status'> & { status: string };
    const owner = RESERVED_ORDERS[index];
    if (raw.status !== owner.status) throw new DatabaseGuardError('Fixture JSON scenario/status does not match its reservation.');
    const order: PreviewOrderDetails = { ...raw, status: owner.status,
      customer: Object.freeze({ ...raw.customer }), price: displayPrice(raw.total_price) };
    toOwnedOrderInsert(order); // Validate every row before collection export or any Pool creation.
    return Object.freeze(order);
  }));
}

// Data is external; authorization identities remain in the independent reserved registry.
export const RESERVED_ORDER_DETAILS = reservedOrderDetailsFromJson(testData);

export function toOwnedOrderInsert(order: PreviewOrderDetails): Insertable<OrdersTable> {
  const owner = RESERVED_ORDERS.find((candidate) => candidate.order_number === order.number
    && candidate.customer_email === order.customer.email && candidate.status === order.status);
  if (!owner) throw new DatabaseGuardError('Fixture does not match an exact reserved scenario; no deletion is allowed.');
  const price = displayPrice(order.total_price);
  if (order.price !== price) throw new DatabaseGuardError('Fixture displayed price does not match its decimal total.');
  const color = order.color.toLowerCase().replace(/ /g, '-');
  // Remove the display suffix before lowercasing: "aero Wheels" must become "aero".
  const wheel_type = order.wheels.replace(' Wheels', '').toLowerCase();
  const payment_method = order.payment.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '').toLowerCase();
  if (!['glacier-blue', 'midnight-black', 'lunar-white'].includes(color)
    || !['aero', 'sport'].includes(wheel_type) || payment_method !== 'avista') {
    throw new DatabaseGuardError('Fixture contains an unsupported color, wheels or payment method.');
  }
  return {
    ...owner, color, wheel_type, customer_name: order.customer.name, customer_email: order.customer.email,
    customer_phone: order.customer.phone, customer_cpf: order.customer.document,
    payment_method, total_price: order.total_price, optionals: [],
  };
}

export function previewDatabaseSettings(env: Environment) {
  if (env.E2E_PREVIEW_DATABASE_ALLOWED !== 'true') {
    throw new DatabaseGuardError('Preview database suite requires its explicit opt-in.');
  }
  // pg 8.20 falls back to PG* variables for some falsy/missing settings.
  // Require a clean per-process SQL environment instead of silently inheriting them.
  if (Object.entries(env).some(([name, value]) => name.toUpperCase().startsWith('PG') && Boolean(value))
    || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new DatabaseGuardError('Ambient PG configuration or disabled TLS is not allowed for this suite.');
  }
  const preview = previewSettings(env);
  if (preview.previewRef !== DATABASE_PREVIEW_REF) {
    throw new DatabaseGuardError('Database access requires the reserved preview project.');
  }
  let connection: URL;
  let password: string;
  try {
    connection = new URL(env.TEST_DATABASE_URL ?? '');
    password = decodeURIComponent(connection.password);
    if (!['postgres:', 'postgresql:'].includes(connection.protocol)
      || connection.hostname !== `db.${DATABASE_PREVIEW_REF}.supabase.co`
      || !['', '5432'].includes(connection.port) || connection.username !== 'postgres'
      || connection.pathname !== '/postgres' || connection.search || connection.hash || !password) {
      throw new Error();
    }
  } catch {
    // Never echo a connection string or an underlying URL/driver exception.
    throw new DatabaseGuardError('TEST_DATABASE_URL must use the exact direct preview endpoint, port 5432 and postgres database/user; URL options are forbidden.');
  }
  const pool: PoolConfig = {
    host: connection.hostname, port: 5432, database: 'postgres', user: 'postgres', password,
    ssl: { rejectUnauthorized: true }, max: 1,
    connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000,
    statement_timeout: 10_000, query_timeout: 12_000,
    lock_timeout: 10_000, idle_in_transaction_session_timeout: 10_000,
    options: '-c search_path=public', application_name: 'velo-m4-preview-tests', client_encoding: 'UTF8',
    keepAlive: true, keepAliveInitialDelayMillis: 10_000,
  };
  return { preview, pool };
}

export function assertOwnedRows(rows: readonly OwnedRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const owner = RESERVED_ORDERS.find((candidate) => candidate.id === row.id
      && candidate.order_number === row.order_number && candidate.customer_email === row.customer_email);
    if (!owner || seen.has(row.id)) {
      throw new DatabaseGuardError('Reserved test identity conflicts with an unowned or duplicate row; no deletion is allowed.');
    }
    seen.add(row.id);
  }
}

export function isAllowedPreviewOrdersRead(request: {
  url: string; method: string; preflightMethod?: string;
}, previewOrigin: string): boolean {
  try {
    const url = new URL(request.url);
    const methodAllowed = request.method === 'GET'
      || (request.method === 'OPTIONS' && request.preflightMethod === 'GET');
    if (!methodAllowed || url.origin !== previewOrigin || url.username || url.password
      || url.pathname !== '/rest/v1/orders' || url.hash) return false;
    const keys = [...url.searchParams.keys()];
    return keys.length === 2 && new Set(keys).size === 2
      && url.searchParams.get('select') === '*'
      && RESERVED_ORDERS.some((order) => url.searchParams.get('order_number') === `eq.${order.order_number}`);
  } catch { return false; }
}

async function databaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof DatabaseGuardError) throw error;
    throw new DatabaseGuardError('Preview database operation failed; driver details and credentials omitted.');
  }
}

function repository(connection: Kysely<Database>) {
  const table = connection.withSchema('public');
  const readCandidates = (db: Kysely<Database>) => db.withSchema('public').selectFrom('orders')
    .select(['id', 'order_number', 'customer_email', 'status'])
    .where((eb) => eb.or([
      eb('id', 'in', RESERVED_ORDERS.map((order) => order.id)),
      eb('order_number', 'in', RESERVED_ORDERS.map((order) => order.order_number)),
      eb('customer_email', 'in', RESERVED_ORDERS.map((order) => order.customer_email)),
    ]))
    // More than three candidates is already a conflict; no unrelated payload is read.
    .limit(4).execute();

  const checkoutCandidates = (db: Kysely<Database>) => db.withSchema('public').selectFrom('orders')
    .select(['id', 'order_number', 'customer_name', 'customer_email', 'customer_phone', 'customer_cpf',
      'color', 'wheel_type', 'optionals', 'payment_method', 'total_price', 'status'])
    .where((eb) => eb.or([
      eb('customer_cpf', '=', RESERVED_CHECKOUT.cpf),
      eb('customer_email', '=', RESERVED_CHECKOUT.email),
    ])).limit(MAX_CHECKOUT_ROWS + 1);

  const checkCheckoutRows = (rows: readonly CheckoutRow[]) => {
    try { assertOwnedCheckoutRows(rows); } catch {
      throw new DatabaseGuardError('Checkout ownership conflict or limit exceeded; no deletion is allowed.');
    }
    if (rows.some((row) => RESERVED_ORDERS.some((owner) => owner.id === row.id
      || owner.order_number === row.order_number))) {
      throw new DatabaseGuardError('Checkout conflicts with a reserved lookup identity; no deletion is allowed.');
    }
  };

  return {
    async prepareCheckout() {
      return databaseOperation(() => table.transaction().setIsolationLevel('serializable').execute(async (transaction) => {
        const before = await checkoutCandidates(transaction).forUpdate().execute();
        checkCheckoutRows(before); // Validate all candidates before the first DELETE.
        const deletedOrders = before.map(({ id, order_number }) => ({ id, order_number }));
        if (before.length > 0) {
          const deleted = await transaction.deleteFrom('orders')
            .where('id', 'in', before.map((row) => row.id))
            .where('customer_cpf', '=', RESERVED_CHECKOUT.cpf)
            .where('customer_email', '=', RESERVED_CHECKOUT.email).executeTakeFirst();
          if (deleted.numDeletedRows !== BigInt(before.length)) {
            throw new DatabaseGuardError('Checkout deletion count changed; transaction must roll back.');
          }
        }
        if ((await checkoutCandidates(transaction).execute()).length !== 0) {
          throw new DatabaseGuardError('Checkout identity is not absent; transaction must roll back.');
        }
        return { deletedBeforeCheckout: before.length, deletedOrders, absentBeforeCheckout: true as const };
      })); // Commit before UI; this method never inserts or deletes in teardown.
    },
    async readCheckout() {
      return databaseOperation(async () => {
        const rows = await checkoutCandidates(table).execute();
        checkCheckoutRows(rows);
        if (rows.length !== 1) throw new DatabaseGuardError('Checkout must retain exactly one owned order.');
        return rows[0];
      });
    },
    async prepare(order: PreviewOrderDetails) {
      const owner = toOwnedOrderInsert(order); // Validate and map before opening the write transaction.
      return databaseOperation(() => table.transaction().execute(async (transaction) => {
        const before = await readCandidates(transaction);
        assertOwnedRows(before);
        const expectedDeleteCount = before.some((row) => row.id === owner.id) ? 1n : 0n;
        const deleted = await transaction.deleteFrom('orders')
          .where('id', '=', owner.id).where('order_number', '=', owner.order_number)
          .where('customer_email', '=', owner.customer_email).executeTakeFirst();
        if (deleted.numDeletedRows !== expectedDeleteCount) {
          throw new DatabaseGuardError('Owned row changed during preparation; transaction must roll back.');
        }
        const inserted = await transaction.insertInto('orders').values(owner)
          .returning(['id', 'order_number', 'customer_email', 'status']).executeTakeFirstOrThrow();
        assertOwnedRows([inserted]);
        if (inserted.id !== owner.id || inserted.status !== owner.status) {
          throw new DatabaseGuardError('Inserted fixture does not match its reserved scenario.');
        }
        return { ...inserted, deletedBeforeInsert: Number(deleted.numDeletedRows), retainedAfterTest: true };
      })); // Commit completes before this promise resolves and before the browser GET.
    },
    async readOwnedRows() {
      return databaseOperation(async () => {
        const rows = await readCandidates(table);
        assertOwnedRows(rows);
        return rows.sort((left, right) => left.order_number.localeCompare(right.order_number));
      });
    },
  };
}

export type PreviewDatabase = ReturnType<typeof repository>;

async function withCleanupPreservingFailure<T>(
  operation: () => Promise<T>, cleanup: () => Promise<void>,
): Promise<T> {
  let outcome: PromiseSettledResult<T>;
  try { outcome = { status: 'fulfilled', value: await operation() }; }
  catch (reason) { outcome = { status: 'rejected', reason }; }

  try { await cleanup(); } catch (error) {
    // Cleanup must still fail a successful case, but cannot replace its original failure.
    if (outcome.status === 'fulfilled') throw error;
  }
  if (outcome.status === 'rejected') throw outcome.reason;
  return outcome.value;
}

// The leased connection and advisory lock remain alive during the browser assertions.
// Closing a session releases the lock even if the process is terminated unexpectedly.
export async function withOwnedPreviewDatabase<T>(
  env: Environment, marker: unknown, use: (database: PreviewDatabase) => Promise<T>,
  assertActive = createPreviewOperationWindow(30_000).assertActive,
): Promise<T> {
  const settings = previewDatabaseSettings(env);
  assertPreviewBuild(marker, settings.preview); // Before Pool creation or the first SQL write.
  assertActive();
  const pool = new Pool(settings.pool);
  let connectionFailed = false;
  pool.on('error', () => { connectionFailed = true; });
  pool.on('connect', (client) => { client.on('error', () => { connectionFailed = true; }); });
  class GuardedDialect extends PostgresDialect {
    override createDriver() {
      return guardPreviewDriver(super.createDriver(), assertActive, (query) =>
        query.sql.trim().replace(/\s+/g, ' ') === 'select pg_catalog.pg_advisory_unlock($1::int, $2::int) as released'
        && query.parameters.length === 2 && query.parameters[0] === LOCK_NAMESPACE && query.parameters[1] === LOCK_SUITE);
    }
  }
  const db = new Kysely<Database>({ dialect: new GuardedDialect({ pool }) });
  return withCleanupPreservingFailure(async () => {
    // Preserve ordinary UI assertions, but sanitize acquisition/release driver failures.
    let callbackFailed = false;
    let callbackFailure: unknown;
    try {
      return await db.connection().execute(async (connection) => {
        const lock = await databaseOperation(() => sql<{ acquired: boolean }>`
          select pg_catalog.pg_try_advisory_lock(${LOCK_NAMESPACE}::int, ${LOCK_SUITE}::int) as acquired
        `.execute(connection));
        if (lock.rows[0]?.acquired !== true) {
          throw new DatabaseGuardError('Another process owns the preview database suite lock; no writes performed.');
        }
        return withCleanupPreservingFailure(async () => {
          let result: T;
          try {
            assertActive();
            result = await use(repository(connection));
            assertActive();
          } catch (error) {
            callbackFailed = true;
            callbackFailure = error;
            throw error;
          }
          if (connectionFailed) throw new DatabaseGuardError('Preview database connection failed during the case.');
          return result;
        }, async () => {
          const unlock = await databaseOperation(() => sql<{ released: boolean }>`
            select pg_catalog.pg_advisory_unlock(${LOCK_NAMESPACE}::int, ${LOCK_SUITE}::int) as released
          `.execute(connection));
          if (unlock.rows[0]?.released !== true) throw new DatabaseGuardError('Preview suite lock release failed.');
        });
      });
    } catch (error) {
      // Kysely's connection release can itself reject after the callback has failed.
      if (callbackFailed) throw callbackFailure;
      if (error instanceof DatabaseGuardError) throw error;
      throw new DatabaseGuardError('Preview database connection failed; driver details and credentials omitted.');
    }
  }, () => databaseOperation(() => db.destroy()));
}

// Validate the caller's dataset before any Pool, then bind methods to the fixed reservation.
// The underlying lifecycle/lock is shared with the lookup suite and remains unchanged.
export async function withOwnedPreviewCheckout<T>(
  env: Environment, marker: unknown, fixture: unknown,
  use: (database: Pick<PreviewDatabase, 'prepareCheckout' | 'readCheckout'>) => Promise<T>,
  assertActive = createPreviewOperationWindow(30_000).assertActive,
): Promise<T> {
  assertCheckoutFixture(fixture);
  return withOwnedPreviewDatabase(env, marker, (database) => use({
    prepareCheckout: () => database.prepareCheckout(),
    readCheckout: () => database.readCheckout(),
  }), assertActive);
}
