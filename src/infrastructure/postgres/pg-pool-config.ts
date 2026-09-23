/**
 * SERVER-ONLY. Pool-size and optional pool-observability configuration for
 * `pg-pool.ts` — Pre-Pilot performance experiment.
 *
 * ## `DATABASE_POOL_MAX`
 *
 * The per-process `pg.Pool` size. Default 1 (unchanged historical
 * behavior). Hosted platforms that serve many concurrent requests from one
 * warm instance (Vercel Fluid compute) queue all of them through a
 * one-connection pool, so the hosted deployment may raise it — this exists
 * so that can be A/B-tested by changing ONE environment variable.
 *
 * Bounds: integer, 1..`MAX_POOL_MAX` (10). 10 is `pg`'s own default and is
 * deliberately conservative: every Vercel instance holds up to this many
 * client connections to Supabase's Transaction Pooler, so the total is
 * (instances x this value) against the pooler's client-connection limit. A
 * larger per-instance value multiplies quickly across instances and gives
 * little extra benefit for a classroom-sized burst. Anything else — zero,
 * negative, non-integer, above the bound, or non-numeric — throws
 * `PgPoolConfigError` (fail closed; never silently clamped or defaulted) —
 * including an empty or blank value, which only an UNSET variable escapes.
 * Errors never echo the raw value or any connection string.
 *
 * ## `DATABASE_POOL_LOG_STATS`
 *
 * Off unless exactly `true`. When on, `attachPoolStatsLogging` writes at most
 * one line per second, and only while a request had to WAIT for a
 * connection (`waitingCount > 0`): `{max,totalCount,idleCount,waitingCount}`.
 * No SQL, parameters, URLs or credentials are ever logged.
 */
export const DEFAULT_POOL_MAX = 1;
export const MAX_POOL_MAX = 10;

export class PgPoolConfigError extends Error {
  constructor(message: string) {
    super(`Invalid PostgreSQL pool configuration: ${message}`);
    this.name = "PgPoolConfigError";
  }
}

export function resolvePoolMax(raw: string | undefined): number {
  // Only a truly UNSET variable means "default". An empty/blank value is a
  // misconfiguration (e.g. a blank Vercel env var) and must NOT silently
  // fall back to the baseline during an A/B experiment.
  if (raw === undefined) {
    return DEFAULT_POOL_MAX;
  }
  const value = raw.trim();
  if (!/^[0-9]+$/.test(value)) {
    throw new PgPoolConfigError(`DATABASE_POOL_MAX must be an integer between 1 and ${MAX_POOL_MAX}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_POOL_MAX) {
    throw new PgPoolConfigError(`DATABASE_POOL_MAX must be an integer between 1 and ${MAX_POOL_MAX}`);
  }
  return parsed;
}

export interface PoolStatsSource {
  options: { max?: number };
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  on(event: "acquire", listener: () => void): unknown;
}

export interface PoolStats {
  max: number | undefined;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export function isPoolStatsLoggingEnabled(raw: string | undefined): boolean {
  return raw === "true";
}

/**
 * Logs pool stats only when a checkout happened while other requests were
 * still waiting, at most once per `minIntervalMs`. The clock and sink are
 * injectable for tests.
 */
export function attachPoolStatsLogging(
  pool: PoolStatsSource,
  log: (stats: PoolStats) => void = (stats) => console.info("pg pool queue", JSON.stringify(stats)),
  now: () => number = Date.now,
  minIntervalMs = 1000,
): void {
  let lastLoggedAt = Number.NEGATIVE_INFINITY;
  pool.on("acquire", () => {
    if (pool.waitingCount <= 0) return;
    const t = now();
    if (t - lastLoggedAt < minIntervalMs) return;
    lastLoggedAt = t;
    log({
      max: pool.options.max,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });
}
