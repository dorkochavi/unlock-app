/**
 * SERVER-ONLY. Tiny request-scoped stage timer that emits a native
 * `Server-Timing` response header (PERFORMANCE-RUN-001 Slice A).
 *
 * Purpose: make hosted/local latency measurable per request (auth vs
 * use-case vs DB statements vs pool wait) with negligible overhead and no
 * dependency. Everything here is observability only: it never changes a
 * response body, status, auth ordering, or control flow.
 *
 * ## Privacy / leakage
 * - Only STATIC, allowlisted metric names are ever emitted (`sanitizeName`
 *   drops anything that does not match `^[a-z][a-z0-9-]{0,23}$`); no SQL
 *   text, parameters, user ids, emails, tokens, route params, or answer
 *   content can reach the header because no API accepts such values.
 * - The browser can read the header (coarse stage names + millisecond
 *   timings + one statement count). That is deliberately accepted as
 *   non-sensitive; set `SERVER_TIMING=off` to omit the header entirely.
 *
 * ## Metrics
 * `auth`/`uc`/`content` etc. = `timeStage` stages (summed per name);
 * `db` = summed statement wall time and `dbn` = statement COUNT (a
 * description-only metric); `dbwait` = summed pool-checkout wait;
 * `total` = whole handler. Overlapping (parallel) statements make `db`
 * a SUM, so it can exceed `total`.
 *
 * Easy to remove: delete this file, `pool-timing.ts`, and the
 * `withServerTiming`/`timeStage` wrappers in the listed routes.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const NAME_RE = /^[a-z][a-z0-9-]{0,23}$/;
const MAX_METRICS = 16;

export function sanitizeName(name: string): string | null {
  return NAME_RE.test(name) ? name : null;
}

export function isServerTimingEnabled(raw: string | undefined = process.env.SERVER_TIMING): boolean {
  return raw !== "off";
}

export interface RequestTimer {
  /** Adds `ms` to the named stage (name must pass `sanitizeName`, else ignored). */
  add(name: string, ms: number): void;
  /** Times `fn` into the named stage; always records, even if `fn` throws. */
  stage<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
  recordStatement(ms: number | null): void;
  recordPoolWait(ms: number): void;
  header(): string;
}

type Clock = () => number;

export function createRequestTimer(clock: Clock = () => performance.now()): RequestTimer {
  const startedAt = clock();
  const stages = new Map<string, number>();
  let dbMs = 0;
  let dbCount = 0;
  let waitMs = 0;
  let waited = false;

  const add = (name: string, ms: number) => {
    const clean = sanitizeName(name);
    if (clean === null || !Number.isFinite(ms) || ms < 0) return;
    if (!stages.has(clean) && stages.size >= MAX_METRICS) return;
    stages.set(clean, (stages.get(clean) ?? 0) + ms);
  };

  return {
    add,
    async stage(name, fn) {
      const t0 = clock();
      try {
        return await fn();
      } finally {
        add(name, clock() - t0);
      }
    },
    recordStatement(ms) {
      dbCount += 1;
      if (ms !== null && ms >= 0) dbMs += ms;
    },
    recordPoolWait(ms) {
      waited = true;
      if (ms >= 0) waitMs += ms;
    },
    header() {
      const parts: string[] = [];
      for (const [name, ms] of stages) parts.push(`${name};dur=${fmt(ms)}`);
      if (dbCount > 0) {
        parts.push(`db;dur=${fmt(dbMs)}`);
        parts.push(`dbn;desc="${Math.trunc(dbCount)}"`);
      }
      if (waited) parts.push(`dbwait;dur=${fmt(waitMs)}`);
      parts.push(`total;dur=${fmt(clock() - startedAt)}`);
      return parts.join(", ");
    },
  };
}

function fmt(ms: number): string {
  return (Math.round(ms * 10) / 10).toFixed(1);
}

const storage = new AsyncLocalStorage<RequestTimer>();

/** The active request's timer, or undefined outside `withServerTiming`. */
export function currentTimer(): RequestTimer | undefined {
  return storage.getStore();
}

/** Times `fn` as stage `name` when a request timer is active; otherwise just runs `fn`. */
export function timeStage<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const timer = storage.getStore();
  return timer ? timer.stage(name, fn) : Promise.resolve().then(fn);
}

/**
 * Runs a route body with a request timer in scope and appends the
 * `Server-Timing` header to the returned Response. Never alters status/body;
 * if header setting fails (immutable headers) the response is returned as-is.
 */
export async function withServerTiming(run: () => Promise<Response>): Promise<Response> {
  if (!isServerTimingEnabled()) return run();
  const timer = createRequestTimer();
  const response = await storage.run(timer, run);
  try {
    response.headers.set("Server-Timing", timer.header());
  } catch {
    // Immutable headers: observability must never break a response.
  }
  return response;
}
