/**
 * Minimal SQL execution seam between the Postgres infrastructure adapters
 * in this directory and whatever actually runs a query — a real
 * node-postgres client/pool in production (not wired up yet — see ADR-013),
 * or `@electric-sql/pglite` in integration tests.
 *
 * Deliberately NOT an ORM and not a query builder: every adapter in this
 * directory writes its own explicit, typed SQL text against this
 * interface. `SqlExecutor` is the common subset of the `query(text,
 * params) -> { rows }` shape that both `pg`'s `Client`/`Pool` and PGlite
 * already expose natively — this is not a new abstraction either library
 * needs bespoke glue to satisfy. Choosing the real network driver later
 * (`pg`, `postgres.js`, a future Supabase server client, ...) requires only
 * a thin adapter to this shape, never rewriting the repositories below.
 */
export interface SqlExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

/**
 * Same structural shape as `SqlExecutor` — the distinct name documents a
 * caller-side contract, not a type-level difference: every repository
 * constructed in this directory MUST only ever be given an executor that
 * is bound to one already-open database transaction on one connection (see
 * `postgres-unit-of-work.ts`'s `PostgresUnitOfWork`). This codebase has no
 * separate non-transactional executor type — ADR-010 requires every write
 * path that touches `Attempt`/`UserQuestionProgress` to run inside a
 * transaction regardless, so there is no legitimate use for one.
 */
export type TransactionExecutor = SqlExecutor;
