import type { CompiledQuery, DatabaseConnection, Driver, QueryResult } from 'kysely';

// The installed Postgres driver calls executeQuery synchronously up to pg.query.
// Gate that boundary, including BEGIN/COMMIT, rather than only the repository call.
export function guardPreviewDriver(
  driver: Driver,
  assertActive: () => void,
  isCleanupQuery: (query: CompiledQuery) => boolean,
): Driver {
  const originals = new WeakMap<DatabaseConnection, DatabaseConnection>();
  const original = (connection: DatabaseConnection) => {
    const value = originals.get(connection);
    if (!value) throw new Error('Unknown guarded preview connection.');
    return value;
  };
  return {
    // Installed Postgres init only binds the Pool. Let it initialize so destroy
    // remains available even when the window expires before acquisition.
    init: () => driver.init(),
    async acquireConnection() {
      assertActive();
      const connection = await driver.acquireConnection();
      try { assertActive(); } catch (error) {
        // Acquisition may finish after timeout; return the lease without sending SQL.
        try { await driver.releaseConnection(connection); } catch { /* Preserve gate failure. */ }
        throw error;
      }
      const guarded: DatabaseConnection = {
        executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
          if (!isCleanupQuery(query)) assertActive();
          return connection.executeQuery<R>(query);
        },
        // Neither real suite uses cursors; fail closed instead of adding an ungated path.
        streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
          throw new Error('Streaming is not enabled for guarded preview SQL.');
        },
      };
      originals.set(guarded, connection);
      return guarded;
    },
    async beginTransaction(connection, settings) {
      assertActive();
      await driver.beginTransaction(connection, settings);
    },
    async commitTransaction(connection) {
      assertActive();
      await driver.commitTransaction(connection);
    },
    // Cleanup is permitted after expiration; no global bypass flag opens new writes.
    rollbackTransaction: (connection) => driver.rollbackTransaction(original(connection)),
    releaseConnection: (connection) => driver.releaseConnection(original(connection)),
    destroy: () => driver.destroy(),
  };
}
