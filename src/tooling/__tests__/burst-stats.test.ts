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

describe("evaluateDuplicateAnswerOutcome (one logical submission sent twice)", () => {
  const ok200 = { status: 200, code: null, shapeOk: true };
  const c409 = (code: string | null) => ({ status: 409, code, shapeOk: true });

  it("accepts 200 + 200 (duplicate reached the idempotent fast path)", async () => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    expect(evaluateDuplicateAnswerOutcome([ok200, ok200])).toEqual({ ok: true, outcome: "200+200" });
  });

  it.each(["ITEM_ALREADY_RESOLVED", "SUBMISSION_ID_REUSED"])("accepts 200 + 409 %s in either order", async (code) => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    const expected = { ok: true, outcome: `200+409:${code}` };
    expect(evaluateDuplicateAnswerOutcome([ok200, c409(code)])).toEqual(expected);
    expect(evaluateDuplicateAnswerOutcome([c409(code), ok200])).toEqual(expected);
  });

  it("fails on 409 + 409 (nothing succeeded)", async () => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    const result = evaluateDuplicateAnswerOutcome([c409("ITEM_ALREADY_RESOLVED"), c409("SUBMISSION_ID_REUSED")]);
    expect(result.ok).toBe(false);
  });

  it.each([null, "SOMETHING_ELSE", "item_already_resolved", "ITEM_ALREADY_RESOLVED; drop table"])(
    "fails on a 409 with an unexpected or malformed code %j",
    async (code) => {
      const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
      expect(evaluateDuplicateAnswerOutcome([ok200, c409(code)]).ok).toBe(false);
    },
  );

  it.each([400, 401, 403, 404, 422, 429, 500, 502, 503, 504])("fails on HTTP %s", async (status) => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    const result = evaluateDuplicateAnswerOutcome([ok200, { status, code: "ANYTHING", shapeOk: true }]);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status });
  });

  it("fails on an unexpected 200 body shape", async () => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    expect(evaluateDuplicateAnswerOutcome([ok200, { status: 200, code: null, shapeOk: false }]).ok).toBe(false);
  });

  it("fails unless given exactly two observations", async () => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    expect(evaluateDuplicateAnswerOutcome([ok200]).ok).toBe(false);
    expect(evaluateDuplicateAnswerOutcome([ok200, ok200, ok200]).ok).toBe(false);
  });

  it("never echoes a malformed code back", async () => {
    const { evaluateDuplicateAnswerOutcome } = await import("../../../scripts/burst/burst-stats.mjs");
    const result = evaluateDuplicateAnswerOutcome([ok200, { status: 418, code: "lower case leak", shapeOk: true }]);
    expect(JSON.stringify(result)).not.toMatch(/leak/);
  });
});
