import { describe, expect, it } from "vitest";

import type { DailyPlan } from "../../../../../application/dailyPlan/ports";
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

describe("toDailyPlanDto", () => {
  it("maps every real DailyPlan field, dropping userId, and serializes Dates to ISO strings", () => {
    const plan = makePlan({
      startedAt: new Date("2026-01-10T09:00:00.000Z"),
      completedAt: new Date("2026-01-10T10:00:00.000Z"),
    });

    const dto = toDailyPlanDto(plan);

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
    const dto = toDailyPlanDto(makePlan());

    expect(dto.startedAt).toBeNull();
    expect(dto.completedAt).toBeNull();
  });

  it("maps every real DailyPlanItem field exactly, dropping userId and dailyPlanId", () => {
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

    const dto = toDailyPlanDto(plan);

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

    const dto = toDailyPlanDto(plan);

    expect(dto.items[0].resolvedAt).toBe("2026-01-10T11:00:00.000Z");
    expect(dto.items[0].completedAt).toBe("2026-01-10T11:00:00.000Z");
  });
});
