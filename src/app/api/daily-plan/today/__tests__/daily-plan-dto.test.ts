import { describe, expect, it } from "vitest";

import type { DailyPlan } from "../../../../../application/dailyPlan/ports";
import type { LearnerQuestionContent } from "../../../../../application/learning/ports";
import { toDailyPlanDto } from "../daily-plan-dto";

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    plannedForDate: "2026-01-10",
    status: "prepared",
    engineVersion: "test-engine-v1",
    generatedAt: new Date("2026-01-10T08:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    items: [],
    ...overrides,
  };
}

const CONTENT_QV1: LearnerQuestionContent = {
  questionVersionId: "qv-1",
  questionType: "SINGLE_CHOICE",
  prompt: "What is 2 + 2?",
  options: [
    { id: "a", content: "3" },
    { id: "b", content: "4" },
  ],
};

describe("toDailyPlanDto", () => {
  it("maps every real DailyPlan field, dropping userId, and serializes Dates to ISO strings", () => {
    const plan = makePlan({
      startedAt: new Date("2026-01-10T09:00:00.000Z"),
      completedAt: new Date("2026-01-10T10:00:00.000Z"),
    });

    const dto = toDailyPlanDto(plan, new Map());

    expect(dto).toEqual({
      id: "plan-1",
      plannedForDate: "2026-01-10",
      status: "prepared",
      engineVersion: "test-engine-v1",
      generatedAt: "2026-01-10T08:00:00.000Z",
      startedAt: "2026-01-10T09:00:00.000Z",
      completedAt: "2026-01-10T10:00:00.000Z",
      items: [],
    });
    expect(dto).not.toHaveProperty("userId");
  });

  it("keeps null Date fields as null, not an empty string or omitted", () => {
    const dto = toDailyPlanDto(makePlan(), new Map());

    expect(dto.startedAt).toBeNull();
    expect(dto.completedAt).toBeNull();
  });

  it("maps every real DailyPlanItem field exactly, dropping userId and dailyPlanId, and merges learner-facing content by exact questionVersionId", () => {
    const plan = makePlan({
      items: [
        {
          id: "item-1",
          dailyPlanId: "plan-1",
          userId: "user-1",
          courseId: "course-1",
          position: 0,
          questionId: "question-1",
          questionVersionId: "qv-1",
          actionType: "REVIEW_DUE",
          tier: "DUE_REVIEW",
          otherApplicableTypes: ["STRENGTHEN_MEMORY"],
          reasons: ["SCHEDULED_REVIEW_DUE"],
          status: "pending",
          resolvedAt: null,
          completedAt: null,
        },
      ],
    });

    const dto = toDailyPlanDto(plan, new Map([["qv-1", CONTENT_QV1]]));

    expect(dto.items).toEqual([
      {
        id: "item-1",
        position: 0,
        courseId: "course-1",
        questionId: "question-1",
        questionVersionId: "qv-1",
        actionType: "REVIEW_DUE",
        tier: "DUE_REVIEW",
        otherApplicableTypes: ["STRENGTHEN_MEMORY"],
        reasons: ["SCHEDULED_REVIEW_DUE"],
        status: "pending",
        resolvedAt: null,
        completedAt: null,
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
        answerOptions: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
      },
    ]);
    expect(dto.items[0]).not.toHaveProperty("userId");
    expect(dto.items[0]).not.toHaveProperty("dailyPlanId");
  });

  it("serializes a resolved item's resolvedAt/completedAt to ISO strings", () => {
    const plan = makePlan({
      items: [
        {
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
          status: "completed",
          resolvedAt: new Date("2026-01-10T11:00:00.000Z"),
          completedAt: new Date("2026-01-10T11:00:00.000Z"),
        },
      ],
    });

    const dto = toDailyPlanDto(plan, new Map([["qv-1", CONTENT_QV1]]));

    expect(dto.items[0].resolvedAt).toBe("2026-01-10T11:00:00.000Z");
    expect(dto.items[0].completedAt).toBe("2026-01-10T11:00:00.000Z");
  });

  it("SECURITY: the serialized DTO never contains correct_answer/correctAnswer/correctOptionIds/explanation", () => {
    const plan = makePlan({
      items: [
        {
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
        },
      ],
    });

    const dto = toDailyPlanDto(plan, new Map([["qv-1", CONTENT_QV1]]));
    const serialized = JSON.stringify(dto);

    expect(serialized).toContain("What is 2 + 2?");
    expect(serialized).not.toContain("correct_answer");
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("correctOptionIds");
    expect(serialized).not.toContain("explanation");
  });

  it("throws (never silently substitutes or omits) when content is missing for an item's exact questionVersionId", () => {
    const plan = makePlan({
      items: [
        {
          id: "item-1",
          dailyPlanId: "plan-1",
          userId: "user-1",
          courseId: "course-1",
          position: 0,
          questionId: "question-1",
          questionVersionId: "qv-missing",
          actionType: "REVIEW_DUE",
          tier: "DUE_REVIEW",
          otherApplicableTypes: [],
          reasons: ["SCHEDULED_REVIEW_DUE"],
          status: "pending",
          resolvedAt: null,
          completedAt: null,
        },
      ],
    });

    expect(() => toDailyPlanDto(plan, new Map([["qv-1", CONTENT_QV1]]))).toThrow();
  });

  it("does not map content by a DIFFERENT item's questionVersionId (exact-id matching, not positional/latest)", () => {
    const contentQv2: LearnerQuestionContent = {
      questionVersionId: "qv-2",
      questionType: "SINGLE_CHOICE",
      prompt: "A different question",
      options: [{ id: "x", content: "X" }],
    };
    const plan = makePlan({
      items: [
        {
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
        },
        {
          id: "item-2",
          dailyPlanId: "plan-1",
          userId: "user-1",
          courseId: "course-1",
          position: 1,
          questionId: "question-2",
          questionVersionId: "qv-2",
          actionType: "STRENGTHEN_MEMORY",
          tier: "STRENGTHEN",
          otherApplicableTypes: [],
          reasons: [],
          status: "pending",
          resolvedAt: null,
          completedAt: null,
        },
      ],
    });

    const dto = toDailyPlanDto(
      plan,
      new Map([
        ["qv-1", CONTENT_QV1],
        ["qv-2", contentQv2],
      ]),
    );

    expect(dto.items[0].prompt).toBe("What is 2 + 2?");
    expect(dto.items[1].prompt).toBe("A different question");
    // Ordering preserved regardless of Map insertion order.
    expect(dto.items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
  });
});
