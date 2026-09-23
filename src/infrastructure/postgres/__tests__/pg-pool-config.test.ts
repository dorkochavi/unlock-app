import { describe, expect, it, vi } from "vitest";

import {
  attachPoolStatsLogging,
  DEFAULT_POOL_MAX,
  isPoolStatsLoggingEnabled,
  MAX_POOL_MAX,
  PgPoolConfigError,
  resolvePoolMax,
} from "../pg-pool-config";

describe("resolvePoolMax", () => {
  it("defaults to 1 when unset", () => {
    expect(DEFAULT_POOL_MAX).toBe(1);
    expect(resolvePoolMax(undefined)).toBe(1);
  });

  it.each(["", "   ", "	"])("rejects an empty/blank value %j (a blank env var must not silently mean the baseline)", (raw) => {
    expect(() => resolvePoolMax(raw)).toThrow(PgPoolConfigError);
  });

  it.each([
    ["1", 1],
    ["5", 5],
    [" 5 ", 5],
    ["10", 10],
    ["05", 5],
  ])("accepts %j -> %i", (raw, expected) => {
    expect(resolvePoolMax(raw)).toBe(expected);
  });

  it("upper bound is 10", () => {
    expect(MAX_POOL_MAX).toBe(10);
  });

  it.each(["0", "-1", "-5", "1.5", "5.0", "1e1", "abc", "5 connections", "0x5", "+5", "11", "100", "99999999999999999999"])(
    "rejects %j fail-closed",
    (raw) => {
      expect(() => resolvePoolMax(raw)).toThrow(PgPoolConfigError);
    },
  );

  it("errors never echo the raw value", () => {
    let thrown: unknown;
    try {
      resolvePoolMax("hunter2-secretish");
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).not.toMatch(/hunter2/);
    expect((thrown as Error).message).toMatch(/DATABASE_POOL_MAX/);
  });
});

describe("isPoolStatsLoggingEnabled", () => {
  it("is on only for exactly 'true'", () => {
    expect(isPoolStatsLoggingEnabled("true")).toBe(true);
    for (const raw of [undefined, "", "1", "TRUE", "yes", "false"]) {
      expect(isPoolStatsLoggingEnabled(raw)).toBe(false);
    }
  });
});

describe("attachPoolStatsLogging", () => {
  function fakePool(waitingCount: number) {
    let listener: (() => void) | undefined;
    const pool = {
      options: { max: 5 },
      totalCount: 5,
      idleCount: 0,
      waitingCount,
      on(_event: "acquire", l: () => void) {
        listener = l;
      },
    };
    return { pool, acquire: () => listener?.() };
  }

  it("logs only max/totalCount/idleCount/waitingCount, and only while requests are waiting", () => {
    const log = vi.fn();
    const { pool, acquire } = fakePool(3);
    attachPoolStatsLogging(pool, log, () => 10_000);
    acquire();
    expect(log).toHaveBeenCalledWith({ max: 5, totalCount: 5, idleCount: 0, waitingCount: 3 });
  });

  it("stays silent when nothing is waiting", () => {
    const log = vi.fn();
    const { pool, acquire } = fakePool(0);
    attachPoolStatsLogging(pool, log, () => 10_000);
    acquire();
    expect(log).not.toHaveBeenCalled();
  });

  it("is throttled to one line per interval", () => {
    const log = vi.fn();
    let t = 10_000;
    const { pool, acquire } = fakePool(2);
    attachPoolStatsLogging(pool, log, () => t, 1000);
    acquire();
    t += 200;
    acquire();
    t += 200;
    acquire();
    expect(log).toHaveBeenCalledTimes(1);
    t += 1000;
    acquire();
    expect(log).toHaveBeenCalledTimes(2);
  });
});
