/**
 * Test-support: structural DB round-trip counting for perf-regression tests
 * (PERFORMANCE-RUN-001). Wrap any `SqlExecutor` / `ConnectionProvider`
 * (typically the PGlite harness) and assert "N DB calls" for a use case.
 *
 * Records ONLY counts and the leading SQL verb (select/insert/update/
 * delete/begin/commit/rollback/other) — never SQL text or parameters — so
 * the counter itself cannot leak data into assertion output.
 *
 *   const counter = createStatementCounter();
 *   const provider = counter.wrapProvider(pgliteConnectionProvider(db));
 *   const pool = counter.wrapExecutor(db as unknown as SqlExecutor); // for non-tx ports
 *   await useCase(...);
 *   expect(counter.total).toBe(9);
 *   expect(counter.byVerb.select).toBe(7);
 *   counter.reset();
 *
 * Statements issued through a wrapped provider's executor and through a
 * wrapped plain executor both count into the same counter.
 */
import type { ConnectionProvider } from "../../../src/infrastructure/postgres/connection-provider";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";

export type StatementVerb =
  | "select"
  | "insert"
  | "update"
  | "delete"
  | "begin"
  | "commit"
  | "rollback"
  | "other";

const VERBS: readonly StatementVerb[] = [
  "select",
  "insert",
  "update",
  "delete",
  "begin",
  "commit",
  "rollback",
];

export function classifyStatement(text: string): StatementVerb {
  const word = /^\s*(?:\/\*.*?\*\/\s*)*([a-z]+)/i.exec(text)?.[1]?.toLowerCase();
  if (word === "with") return "select"; // CTE; counted as a read for coarse purposes
  if (word === "start") return "begin";
  if (word === "end") return "commit";
  return (VERBS as readonly string[]).includes(word ?? "") ? (word as StatementVerb) : "other";
}

export interface StatementCounter {
  /** Every statement, including BEGIN/COMMIT/ROLLBACK. */
  readonly total: number;
  /** Statements excluding transaction control (begin/commit/rollback). */
  readonly nonTx: number;
  readonly byVerb: Readonly<Record<StatementVerb, number>>;
  /** Number of `withConnection` checkouts through wrapped providers. */
  readonly checkouts: number;
  reset(): void;
  wrapExecutor(inner: SqlExecutor): SqlExecutor;
  wrapProvider(inner: ConnectionProvider): ConnectionProvider;
}

export function createStatementCounter(): StatementCounter {
  const emptyVerbs = (): Record<StatementVerb, number> => ({
    select: 0,
    insert: 0,
    update: 0,
    delete: 0,
    begin: 0,
    commit: 0,
    rollback: 0,
    other: 0,
  });
  let byVerb = emptyVerbs();
  let checkouts = 0;

  const wrapExecutor = (inner: SqlExecutor): SqlExecutor => ({
    query(text, params) {
      byVerb[classifyStatement(text)] += 1;
      return inner.query(text, params);
    },
  });

  return {
    get total() {
      return Object.values(byVerb).reduce((a, b) => a + b, 0);
    },
    get nonTx() {
      return this.total - byVerb.begin - byVerb.commit - byVerb.rollback;
    },
    get byVerb() {
      return { ...byVerb };
    },
    get checkouts() {
      return checkouts;
    },
    reset() {
      byVerb = emptyVerbs();
      checkouts = 0;
    },
    wrapExecutor,
    wrapProvider(inner) {
      return {
        withConnection<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T> {
          checkouts += 1;
          return inner.withConnection((db) => fn(wrapExecutor(db)));
        },
      };
    },
  };
}
