/**
 * Regression test for a real auth-before-DB ordering bug that existed in
 * `route.ts` itself: it once constructed `getPool()`/`PgConnectionProvider`/
 * production ports BEFORE calling `authenticate()`, so an unauthenticated
 * request still required `DATABASE_URL` and touched Postgres runtime
 * construction.
 *
 * Unlike a fake-only wiring test, this file mocks ONLY the infrastructure
 * modules `route.ts` itself imports (Supabase auth, `getPool`,
 * `PgConnectionProvider`, the DailyPlan composition root, and
 * `getOrCreateDailyPlanForToday`) and then imports and calls the REAL `GET`
 * export from `../route`. This means the assertions below exercise
 * `route.ts`'s actual closure/control flow, not a re-description of it — if
 * `getPool()`/composition-root construction is ever moved back ahead of
 * authentication in `route.ts`, test A below fails because the mocked
 * `getPool` becomes reachable/called for an unauthenticated request.
 *
 * No real Next.js request/Supabase/pg/network connection anywhere in this
 * file — `NextResponse.json()` itself is real (not mocked), since building
 * a `Response` is not the behavior under test.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

import type { DailyPlan, DailyPlanItem } from "@/application/dailyPlan/ports";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  createProductionDailyPlanPorts: vi.fn(),
  createProductionDailyPlanGenerationSettings: vi.fn(),
  getOrCreateDailyPlanForToday: vi.fn(),
  findManyByVersionIds: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/infrastructure/postgres/pg-pool", () => ({
  getPool: mocks.getPool,
}));

vi.mock("@/infrastructure/postgres/pg-connection-provider", () => ({
  PgConnectionProvider: mocks.PgConnectionProvider,
}));

vi.mock("@/infrastructure/dailyPlan/composition-root", () => ({
  createProductionDailyPlanPorts: mocks.createProductionDailyPlanPorts,
  createProductionDailyPlanGenerationSettings: mocks.createProductionDailyPlanGenerationSettings,
}));

vi.mock("@/application/dailyPlan/get-or-create-daily-plan-for-today", () => ({
  getOrCreateDailyPlanForToday: mocks.getOrCreateDailyPlanForToday,
}));

vi.mock("@/infrastructure/postgres/learner-question-content-repository", () => ({
  PostgresLearnerQuestionContentRepository: vi.fn().mockImplementation(function (
    this: { findManyByVersionIds: typeof mocks.findManyByVersionIds },
  ) {
    this.findManyByVersionIds = mocks.findManyByVersionIds;
  }),
}));

// `vi.mock` calls above are hoisted above this import by Vitest, so `GET`
// here is the real production route, wired against the mocks above.
import { GET } from "../route";

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    userId: "supabase-user-1",
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

function makeItem(overrides: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: "item-1",
    dailyPlanId: "plan-1",
    userId: "supabase-user-1",
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

describe("GET /api/daily-plan/today — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("A. unauthenticated: 401, getPool/DB construction never reached (no DATABASE_URL dependency)", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PgConnectionProvider).not.toHaveBeenCalled();
    expect(mocks.createProductionDailyPlanPorts).not.toHaveBeenCalled();
    expect(mocks.getOrCreateDailyPlanForToday).not.toHaveBeenCalled();
  });

  it("B. authenticated: real DB construction wiring is reached, exactly once, with the real pool/ports", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    const fakeSettings = { marker: "fake-settings" };
    mocks.createProductionDailyPlanGenerationSettings.mockReturnValue(fakeSettings);
    const fakePorts = { marker: "fake-ports" };
    mocks.createProductionDailyPlanPorts.mockReturnValue(fakePorts);
    mocks.getOrCreateDailyPlanForToday.mockResolvedValue({ outcome: "READY", plan: makePlan() });

    const dateSpy = vi.spyOn(globalThis, "Date");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ plan: expect.any(Object) });

    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PgConnectionProvider).toHaveBeenCalledTimes(1);
    expect(mocks.PgConnectionProvider).toHaveBeenCalledWith(fakePool);
    expect(mocks.createProductionDailyPlanPorts).toHaveBeenCalledWith(
      fakePool,
      expect.any(mocks.PgConnectionProvider),
    );
    expect(mocks.getOrCreateDailyPlanForToday).toHaveBeenCalledTimes(1);
    expect(mocks.getOrCreateDailyPlanForToday).toHaveBeenCalledWith(
      { userId: "supabase-user-1", now: expect.any(Date) },
      fakeSettings,
      fakePorts,
    );

    // Exactly one `new Date()` per request, at the true HTTP boundary — see
    // route.ts's own doc comment. `dateSpy` was installed after `makePlan()`
    // (and every other fixture Date) was already constructed above, so this
    // count is solely route.ts's own boundary call.
    expect(dateSpy).toHaveBeenCalledTimes(1);

    dateSpy.mockRestore();
  });

  it("B2. authenticated, READY with items: real wiring reaches PostgresLearnerQuestionContentRepository with the pool, using the plan's exact questionVersionIds", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.createProductionDailyPlanGenerationSettings.mockReturnValue({});
    mocks.createProductionDailyPlanPorts.mockReturnValue({});
    const plan = makePlan({ items: [makeItem({ questionVersionId: "qv-1" })] });
    mocks.getOrCreateDailyPlanForToday.mockResolvedValue({ outcome: "READY", plan });
    mocks.findManyByVersionIds.mockResolvedValue([
      {
        questionVersionId: "qv-1",
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2 + 2?",
        options: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findManyByVersionIds).toHaveBeenCalledWith(["qv-1"]);
    expect(body.plan.items[0]).toMatchObject({
      prompt: "What is 2 + 2?",
      questionType: "SINGLE_CHOICE",
    });
    expect(JSON.stringify(body)).not.toContain("correct_answer");
  });

  it("C. authenticated but DB construction throws: 500 INTERNAL_ERROR, no raw error/secret leaked", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    mocks.getPool.mockImplementation(() => {
      throw new Error(
        "getPool(): DATABASE_URL is not set. postgres://secret-user:hunter2@host/db",
      );
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(mocks.getOrCreateDailyPlanForToday).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("D. route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error(
        "createSupabaseServerClient(): NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set — see .env.example.",
      ),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
