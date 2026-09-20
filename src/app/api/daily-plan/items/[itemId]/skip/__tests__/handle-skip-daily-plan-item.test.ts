/**
 * Unit tests for `handleSkipDailyPlanItem` — the testable core of
 * `POST /api/daily-plan/items/:itemId/skip`. Every dependency is faked; no
 * real Supabase/network/Postgres connection anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

import type { SkipDailyPlanItemResult } from "../../../../../../../application/dailyPlan/skip-daily-plan-item";
import type { RequireAuthenticatedUserResult } from "../../../../../../../infrastructure/supabase/require-authenticated-user";
import { handleSkipDailyPlanItem } from "../handle-skip-daily-plan-item";

const NOW = new Date("2026-02-01T00:00:00.000Z");

function authenticated(userId = "supabase-user-1") {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

describe("handleSkipDailyPlanItem", () => {
  it("unauthenticated: 401, never calls skip", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const skip = vi.fn();

    const response = await handleSkipDailyPlanItem({ authenticate, itemId: "item-1", now: NOW, skip });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(skip).not.toHaveBeenCalled();
  });

  it("never accepts/consumes a client-supplied userId — the ONLY userId reaching skip is authResult.userId", async () => {
    const skip = vi.fn(async (): Promise<SkipDailyPlanItemResult> => ({ kind: "SKIPPED" }));

    await handleSkipDailyPlanItem({
      authenticate: authenticated("the-real-authenticated-user"),
      itemId: "item-from-url",
      now: NOW,
      skip,
    });

    expect(skip).toHaveBeenCalledWith({
      userId: "the-real-authenticated-user",
      dailyPlanItemId: "item-from-url",
      skippedAt: NOW,
    });
  });

  it("ITEM_NOT_FOUND_OR_NOT_OWNED: 404 ITEM_NOT_FOUND", async () => {
    const skip = vi.fn(
      async (): Promise<SkipDailyPlanItemResult> => ({ kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" }),
    );

    const response = await handleSkipDailyPlanItem({
      authenticate: authenticated(),
      itemId: "item-1",
      now: NOW,
      skip,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "ITEM_NOT_FOUND" } });
  });

  it("ALREADY_RESOLVED: 409 with the resolved status", async () => {
    const skip = vi.fn(
      async (): Promise<SkipDailyPlanItemResult> => ({
        kind: "ALREADY_RESOLVED",
        status: "completed",
      }),
    );

    const response = await handleSkipDailyPlanItem({
      authenticate: authenticated(),
      itemId: "item-1",
      now: NOW,
      skip,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "ITEM_ALREADY_RESOLVED", status: "completed" } });
  });

  it("SKIPPED: 200 with status SKIPPED only — no grading/correctness field (Skip is not an answer)", async () => {
    const skip = vi.fn(async (): Promise<SkipDailyPlanItemResult> => ({ kind: "SKIPPED" }));

    const response = await handleSkipDailyPlanItem({
      authenticate: authenticated(),
      itemId: "item-1",
      now: NOW,
      skip,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "SKIPPED" });
  });

  it("unexpected thrown error from skip: stable 500, no raw error/database details leaked", async () => {
    const skip = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSkipDailyPlanItem({
      authenticate: authenticated(),
      itemId: "item-1",
      now: NOW,
      skip,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");

    consoleErrorSpy.mockRestore();
  });

  it("unexpected thrown error from authenticate itself: also mapped to a stable 500, skip never called", async () => {
    const authenticate = vi.fn(async () => {
      throw new Error("unexpected Supabase SDK failure");
    });
    const skip = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSkipDailyPlanItem({ authenticate, itemId: "item-1", now: NOW, skip });

    expect(response.status).toBe(500);
    expect(skip).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
