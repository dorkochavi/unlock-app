/**
 * Unit tests for `handleSubmitDailyPlanItemAnswer` — the testable core of
 * `POST /api/daily-plan/items/:itemId/answer`. Every dependency is faked; no
 * real Supabase/network/Postgres connection anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

import type { SubmitDailyPlanItemAnswerResult } from "../../../../../../../application/dailyPlan/submit-daily-plan-item-answer";
import type { RequireAuthenticatedUserResult } from "../../../../../../../infrastructure/supabase/require-authenticated-user";
import { handleSubmitDailyPlanItemAnswer } from "../handle-submit-daily-plan-item-answer";

const NOW = new Date("2026-02-01T00:00:00.000Z");

function authenticated(userId = "supabase-user-1") {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

function acceptedAttempt(isCorrect: boolean, wasIdempotentRetry = false) {
  return vi.fn(
    async (command: Record<string, unknown>): Promise<SubmitDailyPlanItemAnswerResult> => {
      void command; // asserted from submit.mock.calls below, not here
      return {
        kind: "ACCEPTED",
        attempt: { isCorrect } as never,
        progress: {} as never,
        wasIdempotentRetry,
        wasReconciledViaRebuild: false,
      };
    },
  );
}

describe("handleSubmitDailyPlanItemAnswer", () => {
  it("unauthenticated: 401, never calls submit", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate,
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("non-object body: 400 INVALID_REQUEST, never calls submit", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: null,
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("missing submissionId: 400 INVALID_REQUEST, never calls submit", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("missing selectedAnswer entirely: 400 INVALID_REQUEST", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("malformed selectedAnswer (a number, not a string/array/null): 400 INVALID_REQUEST before submit is called", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: 42 },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("malformed confidenceLevel (not one of low/medium/high): 400 INVALID_REQUEST", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A", confidenceLevel: "very-high" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("negative responseTimeSeconds: 400 INVALID_REQUEST", async () => {
    const submit = vi.fn();

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A", responseTimeSeconds: -1 },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("MULTIPLE_CHOICE selectedAnswer (array of strings) passes structural validation and reaches submit", async () => {
    const submit = acceptedAttempt(true);

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: ["A", "B"] },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(200);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ selectedAnswer: ["A", "B"] }),
    );
  });

  it("selectedAnswer: null passes structural validation (skip is a separate flow, but null is a structurally valid SelectedAnswer)", async () => {
    const submit = acceptedAttempt(false);

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: null },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(200);
  });

  it("never accepts/consumes a client-supplied userId — the ONLY userId reaching submit is authResult.userId", async () => {
    const submit = acceptedAttempt(true);

    await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated("the-real-authenticated-user"),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A", userId: "attacker-supplied-id" },
      now: NOW,
      submit,
    });

    expect(submit).toHaveBeenCalledTimes(1);
    const [command] = submit.mock.calls[0];
    expect(command.userId).toBe("the-real-authenticated-user");
    expect(command).not.toHaveProperty("courseId");
    expect(command).not.toHaveProperty("questionId");
    expect(command).not.toHaveProperty("questionVersionId");
  });

  it("itemId comes from the URL path param, not the request body", async () => {
    const submit = acceptedAttempt(true);

    await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-from-url",
      body: { submissionId: "sub-1", selectedAnswer: "A", dailyPlanItemId: "item-from-body" },
      now: NOW,
      submit,
    });

    const [command] = submit.mock.calls[0];
    expect(command.dailyPlanItemId).toBe("item-from-url");
  });

  it("passes `now` through as answeredAt, never a client-supplied timestamp", async () => {
    const submit = acceptedAttempt(true);

    await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A", answeredAt: "2020-01-01T00:00:00Z" },
      now: NOW,
      submit,
    });

    const [command] = submit.mock.calls[0];
    expect(command.answeredAt).toBe(NOW);
  });

  it("ITEM_NOT_FOUND_OR_NOT_OWNED: 404 ITEM_NOT_FOUND", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "ITEM_NOT_FOUND_OR_NOT_OWNED",
      }),
    );

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "ITEM_NOT_FOUND" } });
  });

  it("DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED: same 404 ITEM_NOT_FOUND — no existence leak distinguishing the two layers", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED",
        dailyPlanItemId: "item-1",
      }),
    );

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "ITEM_NOT_FOUND" } });
  });

  it("DAILY_PLAN_ITEM_ALREADY_RESOLVED: 409 with the resolved status, no grading data", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "DAILY_PLAN_ITEM_ALREADY_RESOLVED",
        dailyPlanItemId: "item-1",
        status: "completed",
      }),
    );

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "ITEM_ALREADY_RESOLVED", status: "completed" } });
  });

  it("IDEMPOTENCY_KEY_CONFLICT: 409 SUBMISSION_ID_REUSED", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "IDEMPOTENCY_KEY_CONFLICT",
        existingAttempt: {} as never,
        conflictingFields: ["selectedAnswer"],
      }),
    );

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "SUBMISSION_ID_REUSED" } });
  });

  it("INVALID_SELECTED_ANSWER: 400 INVALID_ANSWER, raw reason text never leaked into the response body", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "INVALID_SELECTED_ANSWER",
        reason: "duplicate selected option id \"A\" — internal detail",
      }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: ["A", "A"] },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_ANSWER" } });
    expect(JSON.stringify(response.body)).not.toContain("internal detail");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("QUESTION_VERSION_CONSISTENCY_VIOLATION: 500 INTERNAL_ERROR, logged as a data-consistency fault", async () => {
    const submit = vi.fn(
      async (): Promise<SubmitDailyPlanItemAnswerResult> => ({
        kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION",
        questionVersionId: "qv-1",
      }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("ACCEPTED: 200 with isCorrect + wasIdempotentRetry only — no correctOptionIds/grading-definition/internal fields", async () => {
    const submit = acceptedAttempt(true, false);

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "COMPLETED",
      isCorrect: true,
      wasIdempotentRetry: false,
    });
    expect(Object.keys(response.body as object).sort()).toEqual(
      ["isCorrect", "status", "wasIdempotentRetry"].sort(),
    );
  });

  it("ACCEPTED via idempotent retry: wasIdempotentRetry true", async () => {
    const submit = acceptedAttempt(false, true);

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.body).toEqual({
      status: "COMPLETED",
      isCorrect: false,
      wasIdempotentRetry: true,
    });
  });

  it("unexpected thrown error from submit: stable 500, no raw error/database details leaked", async () => {
    const submit = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate: authenticated(),
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");

    consoleErrorSpy.mockRestore();
  });

  it("unexpected thrown error from authenticate itself: also mapped to a stable 500, submit never called", async () => {
    const authenticate = vi.fn(async () => {
      throw new Error("unexpected Supabase SDK failure");
    });
    const submit = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSubmitDailyPlanItemAnswer({
      authenticate,
      itemId: "item-1",
      body: { submissionId: "sub-1", selectedAnswer: "A" },
      now: NOW,
      submit,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(submit).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
