import { describe, expect, it } from "vitest";

import type { DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";

import { selectDisplayedItem } from "../select-displayed-item";

function makeItem(id: string, status: string): DailyPlanItemDto {
  return { id, status } as unknown as DailyPlanItemDto;
}

const fb = (itemId: string) => ({ itemId, isCorrect: true });

describe("selectDisplayedItem", () => {
  it("no feedback: shows first pending item", () => {
    // This test protects against: the normal flow no longer showing the first pending item.
    const items = [makeItem("a", "skipped"), makeItem("b", "pending"), makeItem("c", "pending")];
    expect(selectDisplayedItem(items, null)).toEqual({ item: items[1], feedback: null });
  });

  it("answered item completed + feedback: answered item stays displayed with its feedback", () => {
    // This test protects against F-12: feedback dropped because current advanced to the next pending item.
    const items = [makeItem("a", "completed"), makeItem("b", "pending")];
    expect(selectDisplayedItem(items, fb("a"))).toEqual({ item: items[0], feedback: fb("a") });
  });

  it("feedback cleared: next pending item is displayed", () => {
    // This test protects against Continue not advancing to the next item.
    const items = [makeItem("a", "completed"), makeItem("b", "pending")];
    expect(selectDisplayedItem(items, null).item).toBe(items[1]);
  });

  it("last answered item + feedback: stays displayed until Continue", () => {
    // This test protects against F-12 on the final item: completion screen shown before feedback.
    const items = [makeItem("a", "completed"), makeItem("b", "completed")];
    expect(selectDisplayedItem(items, fb("b"))).toEqual({ item: items[1], feedback: fb("b") });
  });

  it("final feedback cleared: no item, completion state reachable", () => {
    // This test protects against a dead state where completion can never be reached after Continue.
    const items = [makeItem("a", "completed"), makeItem("b", "completed")];
    expect(selectDisplayedItem(items, null)).toEqual({ item: null, feedback: null });
  });

  it("stale feedback for unknown item is ignored", () => {
    // This test protects against feedback for a missing item (e.g. after refetch) blocking progress.
    const items = [makeItem("a", "pending")];
    expect(selectDisplayedItem(items, fb("zzz"))).toEqual({ item: items[0], feedback: null });
  });

  it("feedback for a still-pending item is ignored", () => {
    // This test protects against feedback re-binding to an item the server still considers unresolved.
    const items = [makeItem("a", "pending"), makeItem("b", "pending")];
    expect(selectDisplayedItem(items, fb("b"))).toEqual({ item: items[0], feedback: null });
  });
});
