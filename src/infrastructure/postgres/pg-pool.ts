/**
 * SERVER-ONLY. Never import this module (or `pg-connection-provider.ts`)
 * from a Client Component or from `src/domain/`/`src/application/` — `pg`
 * depends on Node's native `net`/`tls` modules and has no browser build.
 * This directory (`src/infrastructure/postgres/`) is already, by this
 * project's own dependency-direction rule (`CLAUDE.md` §2), never imported
 * by domain/application code directly — only a composition root wires it
 * in. The `typeof window` guard below is a real, enforced backstop for
 * this specific file (not just a comment), since no `server-only`-style
 * package is installed in this repo yet — add one (the officially-blessed
 * `server-only` npm package) once Auth/route work begins and this guard
 * can be formalized further; not needed to make this module server-only,
 * which it already is by construction.
 *
 * Provides the ONE `pg.Pool` for this server process via `getPool()`.
 *
 * ## Lazy, not eager
 *
 * `getPool()` constructs the `Pool` the FIRST time it is actually called,
 * never at module-import time. Deliberately: importing this module (e.g.
 * transitively, through a composition-root import during a unit test run
 * or a build-time static analysis pass) must never open a real network
 * connection or require `DATABASE_URL` to be set. A route handler or
 * production composition root that genuinely needs a connection calls
 * `getPool()` explicitly; nothing else does.
 *
 * ## Singleton + Next.js dev HMR safety
 *
 * The constructed `Pool` is memoized in this module's closure (`pool`),
 * which already gives a real singleton for the lifetime of one server
 * process — sufficient in production, where the module is evaluated once.
 * In Next.js dev (`next dev`), Fast Refresh can re-evaluate this module
 * across recompilations, which would otherwise construct a NEW `Pool` (and
 * leak the old one's underlying TCP connections) on every file save. The
 * `globalThis` guard, active only outside production, survives a module
 * re-evaluation and lets a fresh module instance recover the same `Pool`
 * instead — the standard pattern used for exactly this problem by every
 * Prisma-on-Next.js guide, applied unchanged to `pg.Pool`.
 *
 * ## SSL / TLS
 *
 * Never disabled and never hardcoded to skip verification — there is no
 * `ssl: { rejectUnauthorized: false }` anywhere. TLS settings are resolved
 * by `resolvePoolConnectionSettings` (`pg-ssl-config.ts`): CA CONTENTS from
 * `DATABASE_SSL_CA` (hosted/Vercel), a CA file from `DATABASE_SSL_CA_FILE`
 * or the `sslrootcert` URL parameter (local development). TLS-related URL
 * parameters are stripped before `pg` sees the string, so a stale local
 * file path in `DATABASE_URL` can no longer trigger an implicit file read.
 * See `.env.example`.
 *
 * ## Pool size (`max: 1` by default; `DATABASE_POOL_MAX`)
 *
 * The default stays 1. `DATABASE_POOL_MAX` (integer 1..10, see
 * `pg-pool-config.ts`) exists so a hosted deployment can raise it: a
 * platform that serves many concurrent requests from ONE warm instance
 * (Vercel Fluid compute) queues all of them through a one-connection pool.
 * The rationale below is for the default.
 *
 * `DATABASE_URL` alone does NOT delegate pool sizing — `pg.Pool` defaults
 * to `max: 10` regardless of the connection string, and this app's actual
 * deployment target is Vercel serverless: each invocation can be its own
 * short-lived process, so a `max: 10` pool here would mean up to 10
 * postgres connections PER INVOCATION, multiplied across however many
 * concurrent invocations Vercel runs, against Supabase's own already-
 * pooled `.pooler.supabase.com:6543` Transaction Pooler endpoint (the
 * confirmed `DATABASE_URL` target for this deployment). `max: 1` keeps
 * each serverless invocation's own footprint to one upstream connection,
 * which is what the Transaction Pooler is designed to multiplex across
 * many callers — a locally-unbounded pool here would work against, not
 * with, that pooler.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/infrastructure/postgres/pg-pool.ts must never be evaluated in a " +
      "browser context — pg has no browser build. This module was loaded " +
      "with `window` defined.",
  );
}

import { Pool } from "pg";

import {
  attachPoolStatsLogging,
  isPoolStatsLoggingEnabled,
  resolvePoolMax,
} from "./pg-pool-config";
import { resolvePoolConnectionSettings } from "./pg-ssl-config";

declare global {
  var __unlockPgPool: Pool | undefined;
}

let pool: Pool | undefined = globalThis.__unlockPgPool;

/**
 * Returns the one `pg.Pool` for this process, constructing it on first
 * call. Throws loudly and immediately if `DATABASE_URL` is not set —
 * runtime DB access was actually requested, so a clear, specific error
 * here is far better than a cryptic connection failure two layers down.
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "getPool(): DATABASE_URL is not set. Runtime PostgreSQL access was " +
        "requested but no connection string is configured — set " +
        "DATABASE_URL in .env.local (see .env.example).",
    );
  }

  // Default `max: 1` (`DATABASE_POOL_MAX` overrides, validated) — see this
  // file's own "Pool size" doc comment above for why a serverless
  // deployment must not inherit `pg.Pool`'s own `max: 10` default here.
  const { connectionString, ssl } = resolvePoolConnectionSettings({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL_CA: process.env.DATABASE_SSL_CA,
    DATABASE_SSL_CA_FILE: process.env.DATABASE_SSL_CA_FILE,
  });
  pool = new Pool({ connectionString, ssl, max: resolvePoolMax(process.env.DATABASE_POOL_MAX) });
  if (isPoolStatsLoggingEnabled(process.env.DATABASE_POOL_LOG_STATS)) {
    attachPoolStatsLogging(pool);
  }

  if (process.env.NODE_ENV !== "production") {
    globalThis.__unlockPgPool = pool;
  }

  return pool;
}
