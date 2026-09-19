/**
 * Unit tests for `handleGetDailyPlanToday` — the testable core of
 * `GET /api/daily-plan/today`. Every dependency is faked; no real
 * Supabase/network/Postgres connection anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

import type { DailyPlan, DailyPlanItem } from "../../../../../application/dailyPlan/ports";
import type { GetOrCreateDailyPlanForTodayResult } from "../../../../../application/dailyPlan/get-or-create-daily-plan-for-today";
import type { LearnerQuestionContent } from "../../../../../application/learning/ports";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";
import { handleGetDailyPlanToday } from "../handle-get-daily-plan-today";

const NOW = new Date("2026-01-10T08:00:00.000Z");

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    plannedForDate: "2026-01-10",
    status: "prepared",
    engineVersion: "test-engine-v1",
    generatedAt: NOW,
    startedAt: null,
    completedAt: null,
    items: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: "item-1",
    dailyPlanId: "plan-1",
    userId: "user-1",
    courseId: "course-1",
    position: 0,
    questionId: "question-1",
    questionVersionId: "qv-1",
    actionType: "REVIEW_DUE",
    tier: "DUE_REVIEW",
    otherApplicableTypes: [],
    reasons: ["SCHEDULED_REVIEW_DUE"],
    status: "pending",
    resolvedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function makeContent(overrides: Partial<LearnerQuestionContent> = {}): LearnerQuestionContent {
  return {
    questionVersionId: "qv-1",
    questionType: "SINGLE_CHOICE",
    prompt: "What is 2 + 2?",
    options: [
      { id: "a", content: "3" },
      { id: "b", content: "4" },
    ],
    ...overrides,
  };
}

function authenticatedAs(userId: string) {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

describe("handleGetDailyPlanToday", () => {
  it("A. unauthenticated: returns 401 and never calls generateDailyPlan or loadLearnerQuestionContent", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const generateDailyPlan = vi.fn();
    const loadLearnerQuestionContent = vi.fn();

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(generateDailyPlan).not.toHaveBeenCalled();
    expect(loadLearnerQuestionContent).not.toHaveBeenCalled();
  });

  it("B. READY with no items: uses the authenticated userId, passes the exact injected now, returns 200 with the serialized DTO, never calls loadLearnerQuestionContent", async () => {
    const authenticate = authenticatedAs("supabase-user-1");
    const plan = makePlan({ userId: "supabase-user-1" });
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
    );
    const loadLearnerQuestionContent = vi.fn();

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(generateDailyPlan).toHaveBeenCalledWith({ userId: "supabase-user-1", now: NOW });
    expect(loadLearnerQuestionContent).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      plan: {
        id: "plan-1",
        plannedForDate: "2026-01-10",
        status: "prepared",
        engineVersion: "test-engine-v1",
        generatedAt: NOW.toISOString(),
        startedAt: null,
        completedAt: null,
        items: [],
      },
    });
  });

  it("C. TIMEZONE_NOT_SET: stable 422 response with a stable error code", async () => {
    const authenticate = authenticatedAs("supabase-user-1");
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "TIMEZONE_NOT_SET" }),
    );
    const loadLearnerQuestionContent = vi.fn();

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: { code: "TIMEZONE_NOT_SET" } });
    expect(loadLearnerQuestionContent).not.toHaveBeenCalled();
  });

  it("D. USER_NOT_FOUND: mapped to a server-side provisioning-inconsistency 500, never an ordinary 404", async () => {
    const authenticate = authenticatedAs("supabase-user-1");
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "USER_NOT_FOUND" }),
    );
    const loadLearnerQuestionContent = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(response.status).toBe(500);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual({ error: { code: "USER_PROVISIONING_INCONSISTENT" } });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("E. unexpected thrown error from generateDailyPlan: stable 500, no raw error/database details leaked", async () => {
    const authenticate = authenticatedAs("supabase-user-1");
    const generateDailyPlan = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const loadLearnerQuestionContent = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");
    expect(JSON.stringify(response.body)).not.toContain("ECONNREFUSED");

    consoleErrorSpy.mockRestore();
  });

  it("unexpected thrown error from authenticate itself: also mapped to a stable 500, not left to propagate", async () => {
    const authenticate = vi.fn(async () => {
      throw new Error("unexpected Supabase SDK failure");
    });
    const generateDailyPlan = vi.fn();
    const loadLearnerQuestionContent = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({
      authenticate,
      now: NOW,
      generateDailyPlan,
      loadLearnerQuestionContent,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(generateDailyPlan).not.toHaveBeenCalled();
    expect(loadLearnerQuestionContent).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("F. never accepts/consumes a client-supplied userId — the ONLY userId reaching generateDailyPlan is authResult.userId", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "the-real-authenticated-user",
      }),
    );
    const generateDailyPlan = vi.fn(
      async (
        command: { userId: string; now: Date },
      ): Promise<GetOrCreateDailyPlanForTodayResult> => {
        void command;
        return {
          outcome: "READY",
          plan: makePlan({ userId: "the-real-authenticated-user" }),
        };
      },
    );
    const loadLearnerQuestionContent = vi.fn();

    await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan, loadLearnerQuestionContent });

    expect(generateDailyPlan).toHaveBeenCalledTimes(1);
    const [command] = generateDailyPlan.mock.calls[0];
    expect(Object.keys(command)).toEqual(["userId", "now"]);
    expect(command.userId).toBe("the-real-authenticated-user");
  });

  it("G. never generates a Date itself — the exact injected now is what reaches generateDailyPlan, even under a different faked system clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const authenticate = authenticatedAs("supabase-user-1");
    const generateDailyPlan = vi.fn(
      async (
        command: { userId: string; now: Date },
      ): Promise<GetOrCreateDailyPlanForTodayResult> => {
        void command;
        return { outcome: "READY", plan: makePlan() };
      },
    );
    const loadLearnerQuestionContent = vi.fn();

    await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan, loadLearnerQuestionContent });

    vi.useRealTimers();

    const [command] = generateDailyPlan.mock.calls[0];
    expect(command.now).toBe(NOW);
    expect(command.now).not.toEqual(new Date("2099-01-01T00:00:00.000Z"));
  });

  describe("learner-facing question content (READY with items)", () => {
    it("H. loads content by the exact unique persisted questionVersionIds, merges by exact id, and preserves DailyPlanItem ordering", async () => {
      const item1 = makeItem({ id: "item-1", position: 0, questionVersionId: "qv-1" });
      const item2 = makeItem({
        id: "item-2",
        position: 1,
        questionVersionId: "qv-2",
        actionType: "STRENGTHEN_MEMORY",
        tier: "STRENGTHEN",
      });
      const plan = makePlan({ items: [item1, item2] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      const contentQv2 = makeContent({
        questionVersionId: "qv-2",
        questionType: "MULTIPLE_CHOICE",
        prompt: "Which are prime?",
        options: [
          { id: "x", content: "2" },
          { id: "y", content: "4" },
        ],
      });
      // Deliberately returned out of item order, to prove the merge is by
      // exact id, not by array position.
      const loadLearnerQuestionContent = vi.fn(async () => [contentQv2, makeContent()]);

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      expect(loadLearnerQuestionContent).toHaveBeenCalledWith(["qv-1", "qv-2"]);
      expect(response.status).toBe(200);
      const body = response.body as { plan: { items: Array<Record<string, unknown>> } };
      expect(body.plan.items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
      expect(body.plan.items[0]).toMatchObject({
        questionVersionId: "qv-1",
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
      });
      expect(body.plan.items[1]).toMatchObject({
        questionVersionId: "qv-2",
        questionType: "MULTIPLE_CHOICE",
        prompt: "Which are prime?",
        answerOptions: [
          { id: "x", content: "2" },
          { id: "y", content: "4" },
        ],
      });
    });

    it("I. dedupes questionVersionIds shared across multiple items before loading content", async () => {
      const item1 = makeItem({ id: "item-1", position: 0, questionVersionId: "qv-1" });
      const item2 = makeItem({ id: "item-2", position: 1, questionVersionId: "qv-1" });
      const plan = makePlan({ items: [item1, item2] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      const loadLearnerQuestionContent = vi.fn(async () => [makeContent()]);

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      expect(loadLearnerQuestionContent).toHaveBeenCalledWith(["qv-1"]);
      expect(response.status).toBe(200);
    });

    it("J. content-loading throws: stable 500 INTERNAL_ERROR, no raw error leaked", async () => {
      const plan = makePlan({ items: [makeItem()] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      const loadLearnerQuestionContent = vi.fn(async () => {
        throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
      });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
      expect(JSON.stringify(response.body)).not.toContain("postgres://");
      expect(JSON.stringify(response.body)).not.toContain("ECONNREFUSED");

      consoleErrorSpy.mockRestore();
    });

    it("K. loaded content is missing an entry for a persisted item's questionVersionId: stable 500 INTERNAL_ERROR, never silently substitutes another version", async () => {
      const item1 = makeItem({ id: "item-1", questionVersionId: "qv-1" });
      const item2 = makeItem({ id: "item-2", questionVersionId: "qv-2" });
      const plan = makePlan({ items: [item1, item2] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      // Only qv-1's content is returned — qv-2 is missing.
      const loadLearnerQuestionContent = vi.fn(async () => [makeContent()]);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("L. SECURITY: the full serialized response never contains correct_answer/correctAnswer/correctOptionIds/explanation", async () => {
      const plan = makePlan({ items: [makeItem()] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      const loadLearnerQuestionContent = vi.fn(async () => [makeContent()]);

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      const serialized = JSON.stringify(response.body);
      expect(serialized).toContain("prompt");
      expect(serialized).toContain("answerOptions");
      expect(serialized).toContain("questionType");
      expect(serialized).not.toContain("correct_answer");
      expect(serialized).not.toContain("correctAnswer");
      expect(serialized).not.toContain("correctOptionIds");
      expect(serialized).not.toContain("explanation");
    });

    it("M. supports both SINGLE_CHOICE and MULTIPLE_CHOICE content shapes", async () => {
      const item1 = makeItem({ id: "item-1", questionVersionId: "qv-1" });
      const item2 = makeItem({ id: "item-2", questionVersionId: "qv-2" });
      const plan = makePlan({ items: [item1, item2] });
      const authenticate = authenticatedAs("supabase-user-1");
      const generateDailyPlan = vi.fn(
        async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
      );
      const loadLearnerQuestionContent = vi.fn(async () => [
        makeContent({ questionVersionId: "qv-1", questionType: "SINGLE_CHOICE" }),
        makeContent({
          questionVersionId: "qv-2",
          questionType: "MULTIPLE_CHOICE",
          options: [
            { id: "x", content: "X" },
            { id: "y", content: "Y" },
            { id: "z", content: "Z" },
          ],
        }),
      ]);

      const response = await handleGetDailyPlanToday({
        authenticate,
        now: NOW,
        generateDailyPlan,
        loadLearnerQuestionContent,
      });

      const body = response.body as { plan: { items: Array<Record<string, unknown>> } };
      expect(body.plan.items[0].questionType).toBe("SINGLE_CHOICE");
      expect(body.plan.items[1].questionType).toBe("MULTIPLE_CHOICE");
      expect((body.plan.items[1].answerOptions as unknown[]).length).toBe(3);
    });
  });
});
