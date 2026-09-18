import type { SqlExecutor } from "./sql-executor";

/**
 * "How do I get one exclusive database connection to run BEGIN/COMMIT/
 * ROLLBACK on" — kept as its own tiny seam, separate from `SqlExecutor`
 * itself, specifically so `PostgresUnitOfWork` does not need to know
 * whether it is running against a connection pool (a future `pg.Pool`,
 * where a transaction needs one checked-out `Client` for its lifetime) or
 * a single always-available connection (PGlite in integration tests, which
 * has no pooling concept at all — `withConnection` there simply calls `fn`
 * with the one PGlite instance). Neither case requires changing
 * `PostgresUnitOfWork` or any repository — only which `ConnectionProvider`
 * is constructed at the composition root.
 */
export interface ConnectionProvider {
  withConnection<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T>;
}
