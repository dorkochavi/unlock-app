/**
 * Real `pg.Pool`-backed implementation of `ConnectionProvider`
 * (`connection-provider.ts`) — the production-compatible adapter that
 * interface was always designed for (see its own doc comment: "a future
 * `pg.Pool`-backed provider would instead check out and release one
 * `Client` per call").
 *
 * `pg.PoolClient` satisfies `SqlExecutor` by TypeScript structural typing
 * directly — no wrapper/cast is needed (`SqlExecutor`'s own doc comment
 * anticipated exactly this: "the common subset of the `query(text, params)
 * -> { rows }` shape that both `pg`'s `Client`/`Pool` and PGlite already
 * expose natively"). Verified: `const check: SqlExecutor = {} as PoolClient`
 * type-checks with zero errors.
 *
 * This class owns ONLY connection checkout/release — never `BEGIN`/
 * `COMMIT`/`ROLLBACK`, and never constructs repositories itself. Those
 * remain entirely `PostgresUnitOfWork`/`PostgresDailyPlanUnitOfWork`'s job,
 * unchanged by this file (both already only depend on the abstract
 * `ConnectionProvider`/`SqlExecutor` seam, never on a concrete driver) —
 * this mirrors exactly how `pgliteConnectionProvider`
 * (`supabase/tests/postgres/db-harness.ts`) is the test-side counterpart of
 * the same seam, just backed by a real network connection instead of an
 * in-process WASM engine.
 */
import type { Pool } from "pg";
import type { ConnectionProvider } from "./connection-provider";
import type { SqlExecutor } from "./sql-executor";

export class PgConnectionProvider implements ConnectionProvider {
  constructor(private readonly pool: Pool) {}

  /**
   * Checks out one `PoolClient` from the pool, hands it to `fn` as the
   * `SqlExecutor` every repository/UnitOfWork in this directory already
   * expects, and ALWAYS releases it afterward — success or failure — so a
   * thrown error inside `fn` (e.g. a `ROLLBACK` triggered by
   * `PostgresUnitOfWork`) can never leak a checked-out client and
   * eventually exhaust the pool. The original error is always the one
   * that propagates; this method adds no error handling of its own beyond
   * the `finally` release.
   */
  async withConnection<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
}
