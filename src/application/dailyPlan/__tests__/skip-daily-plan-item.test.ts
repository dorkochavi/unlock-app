/**
 * Unit tests for `skipDailyPlanItem` (ADR-016, Night-Run Slice 3) — a fake
 * `DailyPlanAnswerRepository`, no real Postgres. Real PGlite/transactional
 * proof (no Attempt created, progress/scheduler untouched) lives in
 * `supabase/tests/postgres/skip-daily-plan-item.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";

import type {
  DailyPlanAnswerRepository,
  DailyPlanAnswerTarget,
  ResolveDailyPlanAnswerItemResult,
} from "../../learning/ports";
import { skipDailyPlanItem } from "../skip-daily-plan-item";

const NOW = new Date("2026-02-01T00:00:00.000Z");

function makeItem(overrides: Partial<DailyPlanAnswerTarget> = {}): DailyPlanAnswerTarget {
  return {
    id: "item-1",
    dailyPlanId: "plan-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "qv-1",
    status: "pending",
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DailyPlanAnswerRepository> = {}): DailyPlanAnswerRepository {
  return {
    findItemById: vi.fn(async () => null),
    markCompleted: vi.fn(async () => ({ outcome: "RESOLVED" }) as ResolveDailyPlanAnswerItemResult),
    markSkipped: vi.fn(async () => ({ outcome: "RESOLVED" }) as ResolveDailyPlanAnswerItemResult),
    ...overrides,
  };
}

describe("skipDailyPlanItem", () => {
  it("owner skipping a pending item: SKIPPED, markSkipped called with the item id", async () => {
    const markSkipped = vi.fn(async () => ({ outcome: "RESOLVED" }) as const);
    const repo = makeRepo({
      findItemById: vi.fn(async () => makeItem()),
      markSkipped,
    });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("SKIPPED");
    expect(markSkipped).toHaveBeenCalledWith("item-1", NOW);
  });

  it("nonexistent item: ITEM_NOT_FOUND_OR_NOT_OWNED, markSkipped never called", async () => {
    const markSkipped = vi.fn();
    const repo = makeRepo({ findItemById: vi.fn(async () => null), markSkipped });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect(markSkipped).not.toHaveBeenCalled();
  });

  it("item owned by a DIFFERENT user: ITEM_NOT_FOUND_OR_NOT_OWNED, markSkipped never called (no existence leak)", async () => {
    const markSkipped = vi.fn();
    const repo = makeRepo({
      findItemById: vi.fn(async () => makeItem({ userId: "someone-else" })),
      markSkipped,
    });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    expect(markSkipped).not.toHaveBeenCalled();
  });

  it("already-completed item: ALREADY_RESOLVED with status completed", async () => {
    const repo = makeRepo({
      findItemById: vi.fn(async () => makeItem({ status: "completed" })),
      markSkipped: vi.fn(async () => ({
        outcome: "ALREADY_RESOLVED" as const,
        item: { status: "completed" as const },
      })),
    });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("ALREADY_RESOLVED");
    if (result.kind === "ALREADY_RESOLVED") {
      expect(result.status).toBe("completed");
    }
  });

  it("duplicate skip (already skipped): ALREADY_RESOLVED with status skipped, has no extra effect", async () => {
    const repo = makeRepo({
      findItemById: vi.fn(async () => makeItem({ status: "skipped" })),
      markSkipped: vi.fn(async () => ({
        outcome: "ALREADY_RESOLVED" as const,
        item: { status: "skipped" as const },
      })),
    });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("ALREADY_RESOLVED");
    if (result.kind === "ALREADY_RESOLVED") {
      expect(result.status).toBe("skipped");
    }
  });

  it("markSkipped reporting NOT_FOUND after a successful ownership check: treated as ITEM_NOT_FOUND_OR_NOT_OWNED, not a thrown error", async () => {
    const repo = makeRepo({
      findItemById: vi.fn(async () => makeItem()),
      markSkipped: vi.fn(async () => ({ outcome: "NOT_FOUND" as const })),
    });

    const result = await skipDailyPlanItem(
      { userId: "user-1", dailyPlanItemId: "item-1", skippedAt: NOW },
      { dailyPlanItems: repo },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
  });
});
