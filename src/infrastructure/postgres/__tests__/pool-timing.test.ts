/**
 * `instrumentPoolForTiming` over a FAKE pool/client (no network): proves
 * statement counting, pool-wait attribution, pass-through outside a request,
 * unchanged results/errors, and that no SQL text or parameters reach the
 * Server-Timing header.
 */
import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { withServerTiming } from "@/lib/server-timing";

import { instrumentPoolForTiming } from "../pool-timing";

const SECRET_SQL = "select secret_column from secret_table where email = $1";
const SECRET_PARAM = "someone@example.com";

class FakeClient {
  calls: Array<{ text: string; params?: unknown[] }> = [];
  fail = false;
  query(text: string, params?: unknown[], cb?: (err: Error | null, res?: unknown) => void): unknown {
    this.calls.push({ text, params });
    if (typeof params === "function" || cb) {
      const done = (typeof params === "function" ? params : cb) as (e: Error | null, r?: unknown) => void;
      done(null, { rows: [] });
      return undefined;
    }
    return this.fail ? Promise.reject(new Error("db down")) : Promise.resolve({ rows: [{ ok: 1 }] });
  }
}

class FakePool extends EventEmitter {
  client = new FakeClient();
  connected = false;
  connect(cb?: (err: Error | null, client?: FakeClient, release?: () => void) => void): unknown {
    if (!this.connected) {
      this.connected = true;
      this.emit("connect", this.client);
    }
    if (cb) {
      cb(null, this.client, () => undefined);
      return undefined;
    }
    return Promise.resolve(this.client);
  }
}

function setup() {
  const pool = new FakePool();
  instrumentPoolForTiming(pool as unknown as Pool);
  return pool;
}

describe("instrumentPoolForTiming", () => {
  it("counts statements and pool checkouts for the active request, without exposing SQL or params", async () => {
    const pool = setup();
    const response = await withServerTiming(async () => {
      const client = (await pool.connect()) as FakeClient;
      await client.query("begin");
      const result = await client.query(SECRET_SQL, [SECRET_PARAM]);
      await client.query("commit");
      expect(result).toEqual({ rows: [{ ok: 1 }] });
      return new Response("ok");
    });
    const header = response.headers.get("Server-Timing") ?? "";
    expect(header).toContain('dbn;desc="3"');
    expect(header).toMatch(/db;dur=\d+\.\d/);
    expect(header).toMatch(/dbwait;dur=\d+\.\d/);
    expect(header).not.toMatch(/secret|example|select|begin/i);
    // The wrapped client still forwarded the real SQL/params to the driver.
    expect(pool.client.calls[1]).toEqual({ text: SECRET_SQL, params: [SECRET_PARAM] });
  });

  it("counts callback-form queries and callback-form connects (pool.query's internal path)", async () => {
    const pool = setup();
    const response = await withServerTiming(async () => {
      await new Promise<void>((resolve) => {
        pool.connect((_err, client) => {
          (client as FakeClient).query("select 1", [], () => resolve());
        });
      });
      return new Response("ok");
    });
    const header = response.headers.get("Server-Timing") ?? "";
    expect(header).toContain('dbn;desc="1"');
    expect(header).toContain("dbwait;dur=");
  });

  it("counts a failed statement and still propagates the original rejection", async () => {
    const pool = setup();
    pool.client.fail = true;
    let caught: unknown;
    const response = await withServerTiming(async () => {
      const client = (await pool.connect()) as FakeClient;
      try {
        await client.query("select 1");
      } catch (error) {
        caught = error;
      }
      return new Response("ok");
    });
    expect((caught as Error).message).toBe("db down");
    expect(response.headers.get("Server-Timing")).toContain('dbn;desc="1"');
  });

  it("is a pure pass-through with no active request and does not throw", async () => {
    const pool = setup();
    const client = (await pool.connect()) as FakeClient;
    await expect(client.query("select 1")).resolves.toEqual({ rows: [{ ok: 1 }] });
  });

  it("is idempotent: instrumenting twice does not double count", async () => {
    const pool = new FakePool();
    instrumentPoolForTiming(pool as unknown as Pool);
    instrumentPoolForTiming(pool as unknown as Pool);
    const response = await withServerTiming(async () => {
      const client = (await pool.connect()) as FakeClient;
      await client.query("select 1");
      return new Response("ok");
    });
    expect(response.headers.get("Server-Timing")).toContain('dbn;desc="1"');
  });
});
