import { afterEach, describe, expect, it, vi } from "vitest";

import { logClientRejection, logUnexpectedError, logUnhandledOutcome, summarizeUnexpectedError } from "./ops-log";

function pgError(overrides: Record<string, unknown> = {}): Error {
  return Object.assign(new Error('new row for relation "attempts" violates check constraint'), {
    name: "error",
    code: "23514",
    severity: "ERROR",
    table: "attempts",
    constraint: "attempts_check",
    detail:
      "Failing row contains (11111111-aaaa, learner-uuid-SENTINEL, selected-answer-SENTINEL, secret-SENTINEL).",
    where: "PL/pgSQL function with value where-SENTINEL",
    hint: "hint-SENTINEL",
    query: "INSERT ... query-SENTINEL",
    parameters: ["param-SENTINEL"],
    ...overrides,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("summarizeUnexpectedError", () => {
  it("PostgreSQL errors: keeps code/constraint/table, drops detail/where/hint/query/parameters AND message", () => {
    const summary = summarizeUnexpectedError(pgError());
    expect(summary).toMatchObject({
      errorCode: "23514",
      constraint: "attempts_check",
      table: "attempts",
    });
    expect(summary.message).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain("SENTINEL");
  });

  it("data-exception messages that echo user values are never logged", () => {
    const err = pgError({
      code: "22P02",
      message: 'invalid input syntax for type integer: "answer-SENTINEL"',
    });
    expect(JSON.stringify(summarizeUnexpectedError(err))).not.toContain("SENTINEL");
  });

  it("SyntaxError (body parse) messages are never logged", () => {
    // Some V8 versions echo a body fragment in JSON.parse messages; model that explicitly.
    const caught = new SyntaxError(`Unexpected token 'x', "{\"selectedAnswer\":\"body-SENTINEL"... is not valid JSON`);
    const summary = summarizeUnexpectedError(caught);
    expect(summary.errorName).toBe("SyntaxError");
    expect(JSON.stringify(summary)).not.toContain("SENTINEL");
  });

  it("system-code errors keep code and stack frames but not the host-bearing message", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), { code: "ECONNREFUSED" });
    const summary = summarizeUnexpectedError(err);
    expect(summary.errorName).toBe("Error");
    expect(summary.errorCode).toBe("ECONNREFUSED");
    expect(summary.message).toBeUndefined(); // system-code messages embed host:port
    expect(summary.stackFrames?.length).toBeGreaterThan(0);
    expect(summary.stackFrames!.length).toBeLessThanOrEqual(8);
  });

  it("plain application errors keep a bounded message; EPIPE is a system code, not SQLSTATE", () => {
    expect(summarizeUnexpectedError(new TypeError("Cannot read properties of undefined")).message).toBe(
      "Cannot read properties of undefined",
    );
    expect(summarizeUnexpectedError(Object.assign(new Error("write EPIPE"), { code: "EPIPE" })).message).toBeUndefined();
  });

  it("logUnexpectedError never throws, even for a hostile thrown value (getter that throws)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const hostile = new Proxy({}, { get: () => { throw new Error("boom"); } });
    expect(() => logUnexpectedError("label", hostile)).not.toThrow();
    expect(spy).toHaveBeenCalledWith("label");
  });

  it("log injection / volume: newlines are collapsed and length is bounded", () => {
    const err = new Error(`line1\nFAKE LOG ENTRY\r\n${"x".repeat(5000)}`);
    const summary = summarizeUnexpectedError(err);
    expect(summary.message).not.toMatch(/[\n\r]/);
    expect(summary.message!.length).toBeLessThanOrEqual(301);
    for (const frame of summary.stackFrames ?? []) expect(frame).not.toMatch(/[\n\r]/);
  });

  it("thrown primitives are reduced to a type tag (their text may be arbitrary)", () => {
    expect(summarizeUnexpectedError("password=hunter2-SENTINEL")).toEqual({ errorName: "non-object:string" });
    expect(summarizeUnexpectedError(null)).toEqual({ errorName: "non-object:null" });
    expect(summarizeUnexpectedError(undefined)).toEqual({ errorName: "non-object:undefined" });
  });

  it("does not follow `cause` chains", () => {
    const err = new Error("outer", { cause: pgError() });
    expect(JSON.stringify(summarizeUnexpectedError(err))).not.toContain("SENTINEL");
  });
});

describe("logUnexpectedError / logClientRejection", () => {
  it("logUnexpectedError emits exactly one console.error with the constant label and a summary object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnexpectedError("GET /x: unexpected error", pgError());
    expect(spy).toHaveBeenCalledTimes(1);
    const [label, summary] = spy.mock.calls[0]!;
    expect(label).toBe("GET /x: unexpected error");
    expect(JSON.stringify(summary)).not.toContain("SENTINEL");
  });

  it("logUnexpectedError without an error logs the label only (never an arbitrary object)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnexpectedError("unhandled outcome");
    expect(spy.mock.calls[0]).toEqual(["unhandled outcome"]);
  });

  it("logClientRejection is warn-level (not error-level) and label-only", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logClientRejection("POST /x: INVALID_SELECTED_ANSWER");
    expect(error).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([["POST /x: INVALID_SELECTED_ANSWER"]]);
  });
});

describe("stack frames: message text can never pass as a frame", () => {
  const NL = String.fromCharCode(10);
  const frame = "    at realFn (/app/src/x.ts:10:5)";
  const realFrame = "at realFn (/app/src/x.ts:10:5)";

  it("regression: multi-line message whose later line starts with 'at ' (SQLSTATE error) is not emitted", () => {
    const err = pgError({
      code: "22P02",
      message: 'invalid input syntax for type uuid: "x' + NL + '   at SECRET learner@example.com"',
    });
    err.stack = "error: " + err.message + NL + frame;
    const summary = summarizeUnexpectedError(err);
    expect(JSON.stringify(summary)).not.toMatch(/SECRET|learner@example/);
    expect(summary.stackFrames).toEqual([realFrame]);
  });

  it("even a well-formed fake frame embedded in the message is dropped (header is cut out by locating the message)", () => {
    const err = new Error("boom" + NL + "    at fake (learner@example.com:1:1)");
    err.stack = "Error: " + err.message + NL + frame;
    const summary = summarizeUnexpectedError(err);
    expect(JSON.stringify(summary.stackFrames)).not.toContain("learner@example");
    expect(summary.stackFrames).toEqual([realFrame]);
  });

  it("when the message cannot be located in the stack, only frame-shaped contiguous-tail lines survive", () => {
    const err = new Error("different");
    err.stack = ["Error: other header", "   at free text with spaces SECRET", frame].join(NL);
    expect(summarizeUnexpectedError(err).stackFrames).toEqual([realFrame]);
  });

  it("frame count and length stay bounded", () => {
    const err = new Error("m");
    const many = Array.from({ length: 30 }, (_, i) => "    at f" + i + " (/" + "p".repeat(500) + ":1:1)");
    err.stack = ["Error: m", ...many].join(NL);
    const summary = summarizeUnexpectedError(err);
    expect(summary.stackFrames === undefined || summary.stackFrames.length <= 8).toBe(true);
    for (const f of summary.stackFrames ?? []) expect(f.length).toBeLessThanOrEqual(201);
  });
});

describe("logUnhandledOutcome", () => {
  it("logs only the fixed-vocabulary kind/outcome, never the object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnhandledOutcome("GET /x: unhandled outcome", { kind: "BRAND_NEW_KIND", userId: "u-SENTINEL", detail: "d-SENTINEL" });
    logUnhandledOutcome("GET /x: unhandled outcome", { outcome: "OTHER_OUTCOME", extra: "e-SENTINEL" });
    expect(spy.mock.calls).toEqual([
      ["GET /x: unhandled outcome", { outcome: "BRAND_NEW_KIND" }],
      ["GET /x: unhandled outcome", { outcome: "OTHER_OUTCOME" }],
    ]);
  });

  it("free text, lowercase, oversize or non-object values collapse to UNRECOGNIZED; never throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnhandledOutcome("l", { kind: "learner@example.com" });
    logUnhandledOutcome("l", { kind: "A".repeat(200) });
    logUnhandledOutcome("l", "str-SENTINEL");
    logUnhandledOutcome("l", null);
    expect(spy.mock.calls.map((c) => c[1])).toEqual(Array(4).fill({ outcome: "UNRECOGNIZED" }));
    const hostile = new Proxy({}, { get: () => { throw new Error("boom"); } });
    expect(() => logUnhandledOutcome("l", hostile)).not.toThrow();
  });
});
