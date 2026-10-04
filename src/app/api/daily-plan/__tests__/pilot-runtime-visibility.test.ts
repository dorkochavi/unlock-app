/**
 * Pilot-minimum runtime visibility proof (PILOT_READINESS §3 item 13b).
 *
 * Proves, on the two highest-value learner flows (Today load, answer
 * submission), that an operator reading Runtime Logs can tell
 *   success      -> 2xx, no console.error, no console.warn
 *   expected 4xx -> no console.error (only a constant warn label for the one
 *                   "UI should never send this" case)
 *   unexpected   -> exactly one console.error with a constant route label
 * and that none of the log output carries credentials, learner identity,
 * submitted answers, request bodies or DB row content.
 * Fakes only; no Supabase/Postgres/network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SubmitDailyPlanItemAnswerResult } from "../../../../application/dailyPlan/submit-daily-plan-item-answer";
import type { RequireAuthenticatedUserResult } from "../../../../infrastructure/supabase/require-authenticated-user";
import { handleGetDailyPlanToday } from "../today/handle-get-daily-plan-today";
import { handleSubmitDailyPlanItemAnswer } from "../items/[itemId]/answer/handle-submit-daily-plan-item-answer";

const NOW = new Date("2026-02-01T00:00:00.000Z");
const LEARNER_ID = "learner-uuid-SENTINEL";
const ANSWER = "selected-answer-SENTINEL";
const SECRET = "postgres://user:password-SENTINEL@host:5432/db";

const authed = async (): Promise<RequireAuthenticatedUserResult> => ({
  outcome: "AUTHENTICATED",
  userId: LEARNER_ID,
});

/** A realistic pg error: value-bearing detail/where/parameters plus a connection string in the text. */
function hostileDbError(): Error {
  return Object.assign(new Error(`failure talking to ${SECRET}`), {
    name: "error",
    code: "23514",
    constraint: "attempts_check",
    table: "attempts",
    detail: `Failing row contains (${LEARNER_ID}, ${ANSWER})`,
    parameters: [LEARNER_ID, ANSWER],
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let infoSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function allLogOutput(): string {
  return JSON.stringify(
    [errorSpy, warnSpy, infoSpy, logSpy].flatMap((spy) => spy.mock.calls),
  );
}

function expectNoSensitiveLogOutput() {
  const out = allLogOutput();
  for (const forbidden of ["SENTINEL", "password", "postgres://", "Failing row"]) {
    expect(out).not.toContain(forbidden);
  }
}

function answerDeps(
  submit: (...args: never[]) => Promise<SubmitDailyPlanItemAnswerResult>,
  body: unknown = { submissionId: "sub-1", selectedAnswer: ANSWER },
  authenticate: () => Promise<RequireAuthenticatedUserResult> = authed,
) {
  return {
    authenticate,
    itemId: "item-1",
    body,
    now: NOW,
    submit: submit as never,
    getFeedbackContent: vi.fn(async () => ({ correctOptionIds: ["A"], explanation: null })),
  };
}

describe("answer submission: operator-visible outcome classes", () => {
  it("success: 200, silent in logs", async () => {
    const response = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => ({
        kind: "ACCEPTED",
        attempt: { isCorrect: true, questionVersionId: "qv-1" } as never,
        progress: {} as never,
        wasIdempotentRetry: false,
        wasReconciledViaRebuild: false,
      })),
    );
    expect(response.status).toBe(200);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("expected 401 / 400 / 404 / 409: not error-level", async () => {
    const unauth = await handleSubmitDailyPlanItemAnswer(
      answerDeps(vi.fn() as never, undefined, async () => ({ outcome: "UNAUTHENTICATED" })),
    );
    const badBody = await handleSubmitDailyPlanItemAnswer(answerDeps(vi.fn() as never, null));
    const notFound = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => ({ kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" }) as never),
    );
    const conflict = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => ({ kind: "IDEMPOTENCY_KEY_CONFLICT" }) as never),
    );
    expect([unauth.status, badBody.status, notFound.status, conflict.status]).toEqual([401, 400, 404, 409]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("INVALID_SELECTED_ANSWER (400): warn with constant label; the submitted answer is NOT logged and not error-level", async () => {
    const echoed = `expected a string, an array of strings, or null, got ${JSON.stringify({ x: ANSWER })}`;
    const response = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => ({ kind: "INVALID_SELECTED_ANSWER", reason: echoed }) as never),
    );
    expect(response).toEqual({ status: 400, body: { error: { code: "INVALID_ANSWER" } } });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls).toEqual([
      ["POST /api/daily-plan/items/:itemId/answer: INVALID_SELECTED_ANSWER"],
    ]);
    expectNoSensitiveLogOutput();
  });

  it("unexpected 500 (DB failure): exactly one error-level line, constant label, sanitized summary, generic body", async () => {
    const response = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => {
        throw hostileDbError();
      }),
    );
    expect(response).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]).toBe(
      "POST /api/daily-plan/items/:itemId/answer: unexpected error during submission",
    );
    expect(errorSpy.mock.calls[0]![1]).toMatchObject({ errorCode: "23514", constraint: "attempts_check" });
    expectNoSensitiveLogOutput();
    expect(JSON.stringify(response.body)).not.toMatch(/SENTINEL|password|postgres/);
  });

  it("unexpected failure while authenticating: 500 error-level, no credentials in output", async () => {
    const response = await handleSubmitDailyPlanItemAnswer(
      answerDeps(vi.fn() as never, undefined, async () => {
        throw hostileDbError();
      }),
    );
    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expectNoSensitiveLogOutput();
  });
});

describe("Today load: operator-visible outcome classes", () => {
  const baseDeps = {
    authenticate: authed,
    now: NOW,
    loadLearnerQuestionContent: vi.fn(async () => []),
  };

  it("success (READY, empty plan): 200, silent", async () => {
    const response = await handleGetDailyPlanToday({
      ...baseDeps,
      generateDailyPlan: vi.fn(async () => ({
        outcome: "READY",
        plan: {
          id: "p1",
          localDate: "2026-02-01",
          status: "ACTIVE",
          engineVersion: "v1",
          generatedAt: NOW,
          startedAt: null,
          completedAt: null,
          items: [],
        },
      })) as never,
    });
    expect(response.status).toBe(200);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("expected 401 and 422 TIMEZONE_NOT_SET: not error-level", async () => {
    const unauth = await handleGetDailyPlanToday({
      ...baseDeps,
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      generateDailyPlan: vi.fn() as never,
    });
    const tz = await handleGetDailyPlanToday({
      ...baseDeps,
      generateDailyPlan: vi.fn(async () => ({ outcome: "TIMEZONE_NOT_SET" })) as never,
    });
    expect([unauth.status, tz.status]).toEqual([401, 422]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("unhandled outcome variant: 500 and the operator sees the variant name (fixed vocabulary) but not its payload", async () => {
    const response = await handleGetDailyPlanToday({
      ...baseDeps,
      generateDailyPlan: vi.fn(async () => ({ outcome: "NEW_UNHANDLED_OUTCOME", userId: LEARNER_ID })) as never,
    });
    expect(response.status).toBe(500);
    expect(errorSpy.mock.calls).toEqual([
      ["GET /api/daily-plan/today: unhandled GetOrCreateDailyPlanForTodayResult outcome", { outcome: "NEW_UNHANDLED_OUTCOME" }],
    ]);
    expectNoSensitiveLogOutput();
  });

  it("consistency-fault logs carry no ids (QUESTION_VERSION_CONSISTENCY_VIOLATION)", async () => {
    const response = await handleSubmitDailyPlanItemAnswer(
      answerDeps(async () => ({ kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION", questionVersionId: "qv-SENTINEL" }) as never),
    );
    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expectNoSensitiveLogOutput();
  });

  it("unexpected 500 (generation throws): one error-level line, sanitized", async () => {
    const response = await handleGetDailyPlanToday({
      ...baseDeps,
      generateDailyPlan: vi.fn(async () => {
        throw hostileDbError();
      }) as never,
    });
    expect(response).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]).toBe("GET /api/daily-plan/today: unexpected error during generation");
    expectNoSensitiveLogOutput();
  });
});
