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
 * ## SSL
 *
 * Deliberately NOT hardcoded here — no `ssl: { rejectUnauthorized: false }`
 * or similar. `pg` already parses `sslmode`/`ssl`-related query parameters
 * embedded directly in a `DATABASE_URL` connection string (e.g.
 * `...?sslmode=require`), which is the portable way to express this
 * per-environment: local Postgres typically needs no TLS, hosted Supabase
 * Postgres typically requires it. The exact value belongs in the
 * connection string configured per-environment, not as a code default in
 * this file — see `.env.example`.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/infrastructure/postgres/pg-pool.ts must never be evaluated in a " +
      "browser context — pg has no browser build. This module was loaded " +
      "with `window` defined.",
  );
}

import { Pool } from "pg";

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

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "getPool(): DATABASE_URL is not set. Runtime PostgreSQL access was " +
        "requested but no connection string is configured — set " +
        "DATABASE_URL in .env.local (see .env.example).",
    );
  }

  pool = new Pool({ connectionString });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__unlockPgPool = pool;
  }

  return pool;
}
