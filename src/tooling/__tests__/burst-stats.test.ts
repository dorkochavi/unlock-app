import { describe, expect, it } from "vitest";

import {
  buildReport,
  classifyFailure,
  percentile,
  summarizeLatencies,
} from "../../../scripts/burst/burst-stats.mjs";

describe("percentile", () => {
  it("returns null for an empty array", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("uses nearest-rank on sorted values", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(100);
    expect(percentile(values, 0)).toBe(10);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    percentile(values, 50);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("summarizeLatencies", () => {
  it("summarizes count/min/p50/p95/max with rounding", () => {
    expect(summarizeLatencies([5.04, 15, 25, 35])).toEqual({
      count: 4,
      min: 5,
      p50: 15,
      p95: 35,
      max: 35,
    });
  });

  it("empty -> nulls", () => {
    expect(summarizeLatencies([])).toEqual({ count: 0, min: null, p50: null, p95: null, max: null });
  });
});

describe("classifyFailure", () => {
  it.each([
    [{ step: "today", timedOut: true }, "TIMEOUT"],
    [{ step: "auth", status: 429 }, "AUTH_PROVIDER"],
    [{ step: "answer", message: "remaining connection slots are reserved" }, "DB_OR_POOLER"],
    [{ step: "answer", message: "timeout exceeded when trying to connect" }, "DB_OR_POOLER"],
    [{ step: "answer", code: "53300" }, "DB_OR_POOLER"],
    [{ step: "join", status: 503 }, "APPLICATION_5XX"],
    [{ step: "today", status: 500, message: "unrelated" }, "APPLICATION_5XX"],
    [{ step: "join", status: 409 }, "UNEXPECTED_4XX"],
    [{ step: "join", message: "fetch failed" }, "TRANSPORT"],
    [{ step: "join" }, "OTHER"],
  ])("%j -> %s", (failure, expected) => {
    expect(classifyFailure(failure)).toBe(expected);
  });
});

describe("buildReport", () => {
  it("aggregates per-step latency and failure classes", () => {
    const report = buildReport({
      scenario: "s",
      learners: 3,
      results: [
        { ok: true, steps: { join: 10, today: 20 } },
        { ok: true, steps: { join: 30, today: 40 } },
        { ok: false, steps: { join: 50 }, failure: { step: "today", status: 500 } },
      ],
      extra: { peakConnections: 7 },
    });
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.failuresByClass).toEqual({ APPLICATION_5XX: 1 });
    expect(report.stepLatencyMs.join.count).toBe(3);
    expect(report.stepLatencyMs.today.count).toBe(2);
    expect(report.peakConnections).toBe(7);
  });
});

describe("expandEmailPattern / buildCookieHeader", () => {
  it("expands {n} zero-padded", async () => {
    const { expandEmailPattern } = await import("../../../scripts/burst/burst-stats.mjs");
    expect(expandEmailPattern("burst{n}@example.test", 7)).toBe("burst07@example.test");
    expect(expandEmailPattern("burst{n}@example.test", 30)).toBe("burst30@example.test");
    expect(() => expandEmailPattern("no-placeholder@example.test", 1)).toThrow();
  });

  it("joins cookies into a Cookie header", async () => {
    const { buildCookieHeader } = await import("../../../scripts/burst/burst-stats.mjs");
    expect(buildCookieHeader([{ name: "a", value: "1" }, { name: "b.0", value: "x=y" }])).toBe("a=1; b.0=x=y");
  });
});
