/**
 * Route-contract tests for the optional `learningRecap` on `GET /api/daily-plan/today`
 * (Run TODAY-LEARNING-RECAP-004): absent unless >= 1 item is completed, user- and
 * plan-scoped read, graceful degradation, nothing read when unauthenticated.
 */
import { describe, expect, it, vi } from "vitest";

import type { DailyPlan, DailyPlanItem } from "../../../../../application/dailyPlan/ports";
import type { LearningRecapAttemptRow } from "../../../../../application/dailyPlan/derive-learning-recap";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";
import { handleGetDailyPlanToday, type HandleGetDailyPlanTodayDependencies } from "../handle-get-daily-plan-today";

const NOW = new Date("2026-01-10T08:00:00.000Z");

function item(n: number, status: DailyPlanItem["status"]): DailyPlanItem {
  return {
    id: `item-${n}`,
    dailyPlanId: "plan-1",
    userId: "user-1",
    courseId: "course-1",
    position: n,
    questionId: `q-${n}`,
    questionVersionId: `qv-${n}`,
    actionType: "REVIEW_DUE",
    tier: "DUE_REVIEW",
    otherApplicableTypes: [],
    reasons: [],
    status,
    resolvedAt: status === "pending" ? null : NOW,
    completedAt: status === "completed" ? NOW : null,
  };
}

function plan(items: DailyPlanItem[]): DailyPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    plannedForDate: "2026-01-10",
    status: "prepared",
    engineVersion: "e",
    generatedAt: NOW,
    startedAt: null,
    completedAt: null,
    items,
  };
}

function deps(items: DailyPlanItem[], loadPlanAttempts?: HandleGetDailyPlanTodayDependencies["loadPlanAttempts"]) {
  return {
    authenticate: vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
    ),
    now: NOW,
    generateDailyPlan: vi.fn(async () => ({ outcome: "READY" as const, plan: plan(items) })),
    loadLearnerQuestionContent: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ questionVersionId: id, questionType: "SINGLE_CHOICE" as const, prompt: "p", options: [] })),
    ),
    ...(loadPlanAttempts ? { loadPlanAttempts } : {}),
  };
}

const attemptRow = (id: string, isCorrect: boolean): LearningRecapAttemptRow => ({
  dailyPlanItemId: id,
  isCorrect,
  confidenceLevel: "high",
  topicId: "t1",
  topicName: "מטריצות",
  topicArchived: false,
});

type Body = { plan: { learningRecap?: Record<string, unknown> } };

describe("GET today: learningRecap", () => {
  it("not-started plan: recap absent and the attempts reader is never called", async () => {
    const load = vi.fn();
    const result = await handleGetDailyPlanToday(deps([item(1, "pending"), item(2, "pending")], load));
    expect(result.status).toBe(200);
    expect(load).not.toHaveBeenCalled();
    expect(result.body as Body).not.toHaveProperty("plan.learningRecap");
  });

  it("skipped-only plan: no completed item, so no read and no recap", async () => {
    const load = vi.fn();
    const result = await handleGetDailyPlanToday(deps([item(1, "skipped"), item(2, "pending")], load));
    expect(load).not.toHaveBeenCalled();
    expect(result.body as Body).not.toHaveProperty("plan.learningRecap");
  });

  it("with a completed item: reads exactly once, scoped to the AUTHENTICATED user and THIS plan id, and attaches the derived recap", async () => {
    const load = vi.fn(async () => [attemptRow("item-1", true), attemptRow("item-2", false)]);
    const result = await handleGetDailyPlanToday(
      deps([item(1, "completed"), item(2, "completed"), item(3, "skipped"), item(4, "pending")], load),
    );
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("user-1", "plan-1");
    expect((result.body as Body).plan.learningRecap).toEqual({
      answered: 2,
      skipped: 1,
      correct: 1,
      incorrect: 1,
      sureIncorrect: 1,
      sureCorrect: 1,
      topicsWorked: 1,
      strongTopics: [],
      revisitTopics: ["מטריצות"],
    });
  });

  it("the recap never carries answers, correct keys or per-item data", async () => {
    const load = vi.fn(async () => [attemptRow("item-1", true)]);
    const result = await handleGetDailyPlanToday(deps([item(1, "completed")], load));
    const json = JSON.stringify((result.body as Body).plan.learningRecap);
    expect(json).not.toContain("item-1");
    expect(json).not.toContain("correct_answer");
  });

  it("a failing recap read degrades gracefully: Today still 200, recap omitted, no error leaked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => {
      throw new Error("select * from attempts — postgres://u:secret@h/db");
    });
    const result = await handleGetDailyPlanToday(deps([item(1, "completed")], load));
    expect(result.status).toBe(200);
    expect(result.body as Body).not.toHaveProperty("plan.learningRecap");
    expect(JSON.stringify(result.body)).not.toContain("secret");
    spy.mockRestore();
  });

  it("without the optional dependency nothing changes (existing shape)", async () => {
    const result = await handleGetDailyPlanToday(deps([item(1, "completed")]));
    expect(result.status).toBe(200);
    expect(result.body as Body).not.toHaveProperty("plan.learningRecap");
  });

  it("unauthenticated: 401 and the recap reader is never reached", async () => {
    const load = vi.fn();
    const d = deps([item(1, "completed")], load);
    d.authenticate = vi.fn(async () => ({ outcome: "UNAUTHENTICATED" as const }));
    const result = await handleGetDailyPlanToday(d);
    expect(result.status).toBe(401);
    expect(load).not.toHaveBeenCalled();
    expect(d.generateDailyPlan).not.toHaveBeenCalled();
  });
});
