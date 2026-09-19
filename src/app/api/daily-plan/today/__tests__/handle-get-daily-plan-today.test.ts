/**
 * Unit tests for `handleGetDailyPlanToday` — the testable core of
 * `GET /api/daily-plan/today`. Every dependency is faked; no real
 * Supabase/network/Postgres connection anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

import type { DailyPlan } from "../../../../../application/dailyPlan/ports";
import type { GetOrCreateDailyPlanForTodayResult } from "../../../../../application/dailyPlan/get-or-create-daily-plan-for-today";
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

describe("handleGetDailyPlanToday", () => {
  it("A. unauthenticated: returns 401 and never calls generateDailyPlan", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const generateDailyPlan = vi.fn();

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(generateDailyPlan).not.toHaveBeenCalled();
  });

  it("B. READY: uses the authenticated userId, passes the exact injected now, returns 200 with the serialized DTO", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "supabase-user-1",
      }),
    );
    const plan = makePlan({ userId: "supabase-user-1" });
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "READY", plan }),
    );

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(generateDailyPlan).toHaveBeenCalledWith({ userId: "supabase-user-1", now: NOW });
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
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "supabase-user-1",
      }),
    );
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "TIMEZONE_NOT_SET" }),
    );

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: { code: "TIMEZONE_NOT_SET" } });
  });

  it("D. USER_NOT_FOUND: mapped to a server-side provisioning-inconsistency 500, never an ordinary 404", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "supabase-user-1",
      }),
    );
    const generateDailyPlan = vi.fn(
      async (): Promise<GetOrCreateDailyPlanForTodayResult> => ({ outcome: "USER_NOT_FOUND" }),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(response.status).toBe(500);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual({ error: { code: "USER_PROVISIONING_INCONSISTENT" } });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("E. unexpected thrown error from generateDailyPlan: stable 500, no raw error/database details leaked", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "supabase-user-1",
      }),
    );
    const generateDailyPlan = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

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
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(generateDailyPlan).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("F. never accepts/consumes a client-supplied userId — the ONLY userId reaching generateDailyPlan is authResult.userId", async () => {
    // This function's own dependency shape has no userId/request/query/
    // header parameter anywhere for one to leak in through — proven here
    // by construction: authenticate is the sole source, and whatever it
    // returns is exactly (and only) what generateDailyPlan receives.
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
        void command; // asserted from generateDailyPlan.mock.calls below, not here
        return {
          outcome: "READY",
          plan: makePlan({ userId: "the-real-authenticated-user" }),
        };
      },
    );

    await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    expect(generateDailyPlan).toHaveBeenCalledTimes(1);
    const [command] = generateDailyPlan.mock.calls[0];
    expect(Object.keys(command)).toEqual(["userId", "now"]);
    expect(command.userId).toBe("the-real-authenticated-user");
  });

  it("G. never generates a Date itself — the exact injected now is what reaches generateDailyPlan, even under a different faked system clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({
        outcome: "AUTHENTICATED",
        userId: "supabase-user-1",
      }),
    );
    const generateDailyPlan = vi.fn(
      async (
        command: { userId: string; now: Date },
      ): Promise<GetOrCreateDailyPlanForTodayResult> => {
        void command; // asserted from generateDailyPlan.mock.calls below, not here
        return { outcome: "READY", plan: makePlan() };
      },
    );

    await handleGetDailyPlanToday({ authenticate, now: NOW, generateDailyPlan });

    vi.useRealTimers();

    const [command] = generateDailyPlan.mock.calls[0];
    expect(command.now).toBe(NOW);
    expect(command.now).not.toEqual(new Date("2099-01-01T00:00:00.000Z"));
  });
});
