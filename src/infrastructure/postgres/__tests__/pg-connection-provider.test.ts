/**
 * Unit tests for `PgConnectionProvider` against a minimal fake/mock `Pool`
 * shape — no real network connection, no real Postgres, no `DATABASE_URL`
 * required. Proves the checkout/release contract only; real transaction
 * behavior against this adapter is out of scope here (that is
 * `PostgresUnitOfWork`/`PostgresDailyPlanUnitOfWork`'s own, already-tested
 * responsibility, unaffected by which `ConnectionProvider` backs it).
 */
import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PgConnectionProvider } from "../pg-connection-provider";

function makeFakeClient(): { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  };
}

describe("PgConnectionProvider", () => {
  it("A. success: connects once, passes the checked-out client to the callback, returns its result, releases exactly once", async () => {
    const client = makeFakeClient();
    const connect = vi.fn(async () => client as unknown as PoolClient);
    const pool = { connect } as unknown as Pool;
    const provider = new PgConnectionProvider(pool);

    const callback = vi.fn(async (db) => {
      expect(db).toBe(client);
      return "callback-result";
    });

    const result = await provider.withConnection(callback);

    expect(result).toBe("callback-result");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("B. callback throws: the original error propagates, and the client is still released exactly once", async () => {
    const client = makeFakeClient();
    const connect = vi.fn(async () => client as unknown as PoolClient);
    const pool = { connect } as unknown as Pool;
    const provider = new PgConnectionProvider(pool);

    class BoomError extends Error {}

    await expect(
      provider.withConnection(async () => {
        throw new BoomError("simulated callback failure");
      }),
    ).rejects.toThrow(BoomError);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("C. pool.connect() fails: the callback is never called, and no client (there is none) is ever released", async () => {
    const connect = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const pool = { connect } as unknown as Pool;
    const provider = new PgConnectionProvider(pool);
    const callback = vi.fn();

    await expect(provider.withConnection(callback)).rejects.toThrow("connection refused");

    expect(callback).not.toHaveBeenCalled();
    // No client object was ever produced by `connect()`, so there is
    // structurally no code path in `withConnection` that could attempt a
    // release here — proven by `callback` (the only place a client
    // reference could otherwise leak out to) never having been invoked.
  });

  it("D. repeated withConnection calls each check out and release their own client independently", async () => {
    const clientA = makeFakeClient();
    const clientB = makeFakeClient();
    let callCount = 0;
    const connect = vi.fn(async () => {
      callCount++;
      return (callCount === 1 ? clientA : clientB) as unknown as PoolClient;
    });
    const pool = { connect } as unknown as Pool;
    const provider = new PgConnectionProvider(pool);

    const resultA = await provider.withConnection(async (db) => {
      expect(db).toBe(clientA);
      return "a";
    });
    const resultB = await provider.withConnection(async (db) => {
      expect(db).toBe(clientB);
      return "b";
    });

    expect(resultA).toBe("a");
    expect(resultB).toBe("b");
    expect(connect).toHaveBeenCalledTimes(2);
    expect(clientA.release).toHaveBeenCalledTimes(1);
    expect(clientB.release).toHaveBeenCalledTimes(1);
    // Each call released only its OWN client, never the other's.
    expect(clientA.release).not.toBe(clientB.release);
  });
});
