/**
 * Unit tests for `getPool()` (`pg-pool.ts`)'s lazy-singleton/HMR-survival
 * behavior — no real network connection, no real Postgres. Constructing a
 * `pg.Pool` does not itself open a connection (it dials lazily on first
 * `.connect()`/`.query()`, neither of which any test here calls), so a
 * syntactically-valid-but-unreachable `DATABASE_URL` is enough to exercise
 * this module's own logic without ever touching a network.
 *
 * Each test dynamically re-imports the module after `vi.resetModules()` to
 * get a fresh module instance — this is what actually simulates a Next.js
 * dev HMR reload closely enough to test the `globalThis` recovery path.
 * Env vars are stubbed via `vi.stubEnv` (not direct `process.env`
 * assignment — `NODE_ENV` is typed read-only in this repo's Node types)
 * and auto-restored via `vi.unstubAllEnvs()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FAKE_CONNECTION_STRING = "postgres://user:pass@localhost:5432/unlock_test";

function clearGlobalPool(): void {
  delete (globalThis as unknown as Record<string, unknown>).__unlockPgPool;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", undefined as unknown as string);
  clearGlobalPool();
  vi.resetModules();
});

afterEach(async () => {
  const pool = (globalThis as unknown as { __unlockPgPool?: { end: () => Promise<void> } })
    .__unlockPgPool;
  if (pool) {
    await pool.end().catch(() => {});
  }
  clearGlobalPool();
  vi.unstubAllEnvs();
});

describe("getPool", () => {
  it("importing the module does not throw and does not require DATABASE_URL (lazy, not eager)", async () => {
    await expect(import("../pg-pool")).resolves.toBeDefined();
  });

  it("throws a clear, specific error when DATABASE_URL is not set and getPool() is actually called", async () => {
    const { getPool } = await import("../pg-pool");
    expect(() => getPool()).toThrow(/DATABASE_URL is not set/);
  });

  it("returns a usable Pool once DATABASE_URL is set, without throwing", async () => {
    vi.stubEnv("DATABASE_URL", FAKE_CONNECTION_STRING);
    const { getPool } = await import("../pg-pool");
    const pool = getPool();
    expect(pool).toBeDefined();
    expect(typeof pool.connect).toBe("function");
  });

  it("configures max: 1 — a serverless invocation must not inherit pg.Pool's own max: 10 default against Supabase's Transaction Pooler", async () => {
    vi.stubEnv("DATABASE_URL", FAKE_CONNECTION_STRING);
    const { getPool } = await import("../pg-pool");
    const pool = getPool();
    expect(pool.options.max).toBe(1);
  });

  it("memoizes: repeated calls within the same module instance return the identical Pool", async () => {
    vi.stubEnv("DATABASE_URL", FAKE_CONNECTION_STRING);
    const { getPool } = await import("../pg-pool");
    const first = getPool();
    const second = getPool();
    expect(second).toBe(first);
  });

  it("survives a simulated HMR module reload: a fresh module instance recovers the SAME Pool via globalThis, even once DATABASE_URL is no longer set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", FAKE_CONNECTION_STRING);

    const first = await import("../pg-pool");
    const firstPool = first.getPool();

    // Simulate a Next.js dev Fast Refresh re-evaluation of this module —
    // and remove DATABASE_URL to prove recovery happens purely via
    // globalThis, not by re-reading the env a second time.
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", undefined as unknown as string);

    const second = await import("../pg-pool");
    const secondPool = second.getPool();

    expect(secondPool).toBe(firstPool);
  });

  it("does NOT persist across a module reload in production (no globalThis guard write)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", FAKE_CONNECTION_STRING);

    const first = await import("../pg-pool");
    first.getPool();

    expect(
      (globalThis as unknown as { __unlockPgPool?: unknown }).__unlockPgPool,
    ).toBeUndefined();
  });
});

describe("getPool TLS wiring", () => {
  const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfakefake\n-----END CERTIFICATE-----";
  const HOSTED = "postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
  const STALE = "sslrootcert=C%3A%5CUsers%5Cdorko%5Cnope%5Csupabase-ca.crt";

  it("hosted runtime: DATABASE_SSL_CA is used and a stale local sslrootcert path in DATABASE_URL does not crash (Vercel ENOENT regression)", async () => {
    vi.stubEnv("DATABASE_URL", `${HOSTED}?sslmode=verify-full&${STALE}`);
    vi.stubEnv("DATABASE_SSL_CA", PEM);
    const { getPool } = await import("../pg-pool");
    const pool = getPool();
    expect(pool.options.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("stale local path and no DATABASE_SSL_CA fails with a clear configuration error, not a raw ENOENT", async () => {
    vi.stubEnv("DATABASE_URL", `${HOSTED}?sslmode=verify-full&${STALE}`);
    vi.stubEnv("DATABASE_SSL_CA", undefined as unknown as string);
    const { getPool } = await import("../pg-pool");
    expect(() => getPool()).toThrow(/Invalid PostgreSQL TLS configuration/);
  });
});
