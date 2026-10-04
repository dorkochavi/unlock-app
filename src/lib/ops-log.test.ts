import { afterEach, describe, expect, it, vi } from "vitest";

import { logClientRejection, logUnexpectedError, summarizeUnexpectedError } from "./ops-log";

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
