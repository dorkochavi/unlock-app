/**
 * SERVER-ONLY. Optional per-request DB observability for a `pg.Pool`
 * (PERFORMANCE-RUN-001 Slice A): counts statements and measures statement
 * time and pool-checkout wait, attributing them to the request timer that
 * was active when the call was MADE (captured eagerly, so it does not
 * depend on async-context propagation through pg's internal queues).
 *
 * Records only counts and milliseconds: never SQL text or parameters.
 * Outside `withServerTiming` (no active timer) the wrappers are pure
 * pass-through. Called once per pool from `pg-pool.ts`.
 */
import type { Pool, PoolClient } from "pg";

import { currentTimer } from "@/lib/server-timing";

const INSTRUMENTED = Symbol.for("unlock.poolTimingInstrumented");

type AnyFn = (...args: unknown[]) => unknown;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === "function";
}

export function instrumentPoolForTiming(pool: Pool, clock: () => number = () => performance.now()): void {
  const marked = pool as unknown as Record<symbol, boolean>;
  if (marked[INSTRUMENTED]) return;
  marked[INSTRUMENTED] = true;

  // Statements: wrap each physical client's `query` once, when it is created.
  pool.on("connect", (client: PoolClient) => {
    const original = client.query.bind(client) as AnyFn;
    (client as unknown as { query: AnyFn }).query = (...args) => {
      const timer = currentTimer();
      if (!timer) return original(...args);
      const t0 = clock();
      const result = original(...args);
      if (isThenable(result)) {
        const done = () => timer.recordStatement(clock() - t0);
        result.then(done, done);
      } else {
        timer.recordStatement(null); // callback form: count only
      }
      return result;
    };
  });

  // Pool checkout wait (also what `pool.query` uses internally via `this.connect`).
  const originalConnect = pool.connect.bind(pool) as AnyFn;
  (pool as unknown as { connect: AnyFn }).connect = (...args) => {
    const timer = currentTimer();
    if (!timer) return originalConnect(...args);
    const t0 = clock();
    const done = () => timer.recordPoolWait(clock() - t0);
    if (typeof args[0] === "function") {
      const cb = args[0] as AnyFn;
      return originalConnect((...cbArgs: unknown[]) => {
        done();
        return cb(...cbArgs);
      });
    }
    const result = originalConnect(...args);
    if (isThenable(result)) result.then(done, done);
    return result;
  };
}
