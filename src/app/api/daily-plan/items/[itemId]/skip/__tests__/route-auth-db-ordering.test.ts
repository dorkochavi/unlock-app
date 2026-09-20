/**
 * Regression coverage for the same auth-before-DB ordering property the
 * answer route's own `route-auth-db-ordering.test.ts` protects, applied to
 * `POST /api/daily-plan/items/:itemId/skip`.
 *
 * Mocks ONLY the infrastructure/application modules `route.ts` itself
 * imports, then imports and calls the REAL `POST` export from `../route`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresDailyPlanRepository: vi.fn(),
  skipDailyPlanItem: vi.fn(),
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

vi.mock("@/infrastructure/postgres/daily-plan-repository", () => ({
  PostgresDailyPlanRepository: mocks.PostgresDailyPlanRepository,
}));

vi.mock("@/application/dailyPlan/skip-daily-plan-item", () => ({
  skipDailyPlanItem: mocks.skipDailyPlanItem,
}));

// `vi.mock` calls above are hoisted above this import by Vitest, so `POST`
// here is the real production route, wired against the mocks above.
import { POST } from "../route";

function makeRequest(): Request {
  return new Request("http://localhost/api/daily-plan/items/item-1/skip", { method: "POST" });
}

function makeParams(itemId: string): { params: Promise<{ itemId: string }> } {
  return { params: Promise.resolve({ itemId }) };
}

describe("POST /api/daily-plan/items/:itemId/skip — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("A. unauthenticated: 401, getPool/repository construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(makeRequest(), makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresDailyPlanRepository).not.toHaveBeenCalled();
    expect(mocks.skipDailyPlanItem).not.toHaveBeenCalled();
  });

  it("B. authenticated: real DB construction wiring is reached, exactly once, with the URL itemId and authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.skipDailyPlanItem.mockResolvedValue({ kind: "SKIPPED" });

    const response = await POST(makeRequest(), makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "SKIPPED" });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresDailyPlanRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.skipDailyPlanItem).toHaveBeenCalledTimes(1);

    const [command] = mocks.skipDailyPlanItem.mock.calls[0];
    expect(command.userId).toBe("supabase-user-1");
    expect(command.dailyPlanItemId).toBe("item-1");
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

    const response = await POST(makeRequest(), makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("hunter2");

    consoleErrorSpy.mockRestore();
  });

  it("D. route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error("createSupabaseServerClient(): missing env vars."),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(), makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
