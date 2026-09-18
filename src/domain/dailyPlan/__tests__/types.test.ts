import { describe, expect, it } from "vitest";

import { canResolveDailyPlanItem, DAILY_PLAN_ITEM_STATUSES } from "../types";

describe("canResolveDailyPlanItem", () => {
  it("allows resolving a pending item", () => {
    expect(canResolveDailyPlanItem("pending")).toBe(true);
  });

  it("does not allow resolving an already-completed item", () => {
    expect(canResolveDailyPlanItem("completed")).toBe(false);
  });

  it("does not allow resolving an already-skipped item", () => {
    expect(canResolveDailyPlanItem("skipped")).toBe(false);
  });

  it("covers exactly the three declared statuses", () => {
    expect(DAILY_PLAN_ITEM_STATUSES).toEqual(["pending", "completed", "skipped"]);
  });
});
