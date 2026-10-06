import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRequestTimer,
  currentTimer,
  isServerTimingEnabled,
  sanitizeName,
  timeStage,
  withServerTiming,
} from "./server-timing";

function fakeClock(steps: number[]): () => number {
  let i = 0;
  return () => steps[Math.min(i++, steps.length - 1)];
}

afterEach(() => vi.unstubAllEnvs());

describe("sanitizeName", () => {
  it.each(["auth", "uc", "db-wait", "content"])("accepts %s", (n) => {
    expect(sanitizeName(n)).toBe(n);
  });
  it.each(["", "Auth", "1abc", "a b", "a;dur=1", 'a"b', "a,b", "user@example.com", "x".repeat(25), "a\r\nSet-Cookie: x"])(
    "rejects %j",
    (n) => {
      expect(sanitizeName(n)).toBeNull();
    },
  );
});

describe("createRequestTimer", () => {
  it("formats stages, db metrics and total as a Server-Timing header", async () => {
    // clock reads: start=0, stage t0=10, stage end=22.34, header total=100
    const timer = createRequestTimer(fakeClock([0, 10, 22.34, 100]));
    await timer.stage("auth", async () => "ok");
    timer.recordStatement(1.26);
    timer.recordStatement(null);
    timer.recordPoolWait(3);
    expect(timer.header()).toBe('auth;dur=12.3, db;dur=1.3, dbn;desc="2", dbwait;dur=3.0, total;dur=100.0');
  });

  it("omits db metrics when nothing ran and always ends with total", () => {
    expect(createRequestTimer(fakeClock([0, 5])).header()).toBe("total;dur=5.0");
  });

  it("sums repeated stages and records even when the stage throws", async () => {
    const timer = createRequestTimer(fakeClock([0, 0, 1, 1, 3, 10]));
    await timer.stage("uc", () => 1);
    await expect(
      timer.stage("uc", () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");
    expect(timer.header()).toBe("uc;dur=3.0, total;dur=10.0");
  });

  it("silently drops invalid names, negative/NaN durations, and caps metric count", () => {
    const timer = createRequestTimer(fakeClock([0, 1]));
    timer.add("Bad Name", 5);
    timer.add("ok", Number.NaN);
    timer.add("ok", -1);
    for (let i = 0; i < 40; i++) timer.add(`s${String.fromCharCode(97 + (i % 26))}${i}`, 1);
    const header = timer.header();
    expect(header).not.toContain("Bad");
    expect(header).not.toContain("ok;");
    expect(header.split(", ").length).toBeLessThanOrEqual(17); // 16 stages + total
  });

  it("header contains only the allowed grammar (no CR/LF, quotes only in dbn)", () => {
    const timer = createRequestTimer(fakeClock([0, 1]));
    timer.add("a\r\nSet-Cookie: x", 1);
    timer.recordStatement(1);
    expect(timer.header()).toMatch(/^[a-z0-9;=.," -]+$/);
  });
});

describe("timeStage / currentTimer / withServerTiming", () => {
  it("timeStage outside a request just runs the function", async () => {
    expect(currentTimer()).toBeUndefined();
    await expect(timeStage("auth", () => 42)).resolves.toBe(42);
  });

  it("adds a Server-Timing header and leaves status and body untouched", async () => {
    const response = await withServerTiming(async () => {
      await timeStage("auth", async () => undefined);
      expect(currentTimer()).toBeDefined();
      return Response.json({ a: 1 }, { status: 201 });
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ a: 1 });
    expect(response.headers.get("Server-Timing")).toMatch(/^auth;dur=\d+\.\d, total;dur=\d+\.\d$/);
  });

  it("does not leak the timer after the request and keeps concurrent requests isolated", async () => {
    const [a, b] = await Promise.all([
      withServerTiming(async () => {
        await timeStage("aaa", async () => undefined);
        return new Response(null);
      }),
      withServerTiming(async () => {
        await timeStage("bbb", async () => undefined);
        return new Response(null);
      }),
    ]);
    expect(a.headers.get("Server-Timing")).toContain("aaa;");
    expect(a.headers.get("Server-Timing")).not.toContain("bbb");
    expect(b.headers.get("Server-Timing")).toContain("bbb;");
    expect(currentTimer()).toBeUndefined();
  });

  it("propagates handler errors unchanged", async () => {
    await expect(
      withServerTiming(async () => {
        throw new Error("route failed");
      }),
    ).rejects.toThrow("route failed");
  });

  it("does not break a response whose headers are immutable", async () => {
    const response = await withServerTiming(async () => Response.redirect("http://localhost/x", 302));
    expect(response.status).toBe(302);
  });

  it("SERVER_TIMING=off omits the header", async () => {
    vi.stubEnv("SERVER_TIMING", "off");
    expect(isServerTimingEnabled()).toBe(false);
    const response = await withServerTiming(async () => new Response("x"));
    expect(response.headers.get("Server-Timing")).toBeNull();
  });
});
