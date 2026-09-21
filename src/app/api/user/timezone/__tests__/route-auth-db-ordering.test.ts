/**
 * Regression coverage for the same auth-before-DB ordering property
 * `daily-plan/today/__tests__/route-auth-db-ordering.test.ts` protects,
 * applied to `POST /api/user/timezone`: `getPool()`/
 * `PostgresUserRepository` construction must be structurally unreachable
 * for an unauthenticated request.
 *
 * Mocks ONLY the infrastructure modules `route.ts` itself imports
 * (Supabase auth, `getPool`, `setUserTimezone`) and then imports and calls
 * the REAL `POST` export from `../route` — so these assertions exercise
 * `route.ts`'s actual closure/control flow, not a re-description of it.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresUserRepository: vi.fn(),
  setUserTimezone: vi.fn(),
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

vi.mock("@/infrastructure/postgres/user-repository", () => ({
  PostgresUserRepository: mocks.PostgresUserRepository,
}));

vi.mock("@/application/user/set-user-timezone", () => ({
  setUserTimezone: mocks.setUserTimezone,
}));

// `vi.mock` calls above are hoisted above this import by Vitest, so `POST`
// here is the real production route, wired against the mocks above.
import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/user/timezone", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/user/timezone — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("A. unauthenticated: 401, getPool/repository construction never reached (no DATABASE_URL dependency)", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(makeRequest({ timezone: "Asia/Jerusalem" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresUserRepository).not.toHaveBeenCalled();
    expect(mocks.setUserTimezone).not.toHaveBeenCalled();
  });

  it("B. authenticated but malformed body: 400, getPool/repository construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: { code: "INVALID_TIMEZONE" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresUserRepository).not.toHaveBeenCalled();
  });

  it("C. authenticated with a well-formed body: real DB construction wiring is reached, exactly once", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.setUserTimezone.mockResolvedValue({ outcome: "UPDATED", timezone: "Asia/Jerusalem" });

    const response = await POST(makeRequest({ timezone: "Asia/Jerusalem" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ timezone: "Asia/Jerusalem" });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresUserRepository).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresUserRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.setUserTimezone).toHaveBeenCalledWith(
      { actorUserId: "supabase-user-1", timezone: "Asia/Jerusalem" },
      expect.any(mocks.PostgresUserRepository),
    );
  });

  it("D. authenticated but DB construction throws: 500 INTERNAL_ERROR, no raw error/secret leaked", async () => {
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

    const response = await POST(makeRequest({ timezone: "Asia/Jerusalem" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(mocks.setUserTimezone).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("E. route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error(
        "createSupabaseServerClient(): NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set — see .env.example.",
      ),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest({ timezone: "Asia/Jerusalem" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("POST /api/user/timezone — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = makeRequest({ timezone: "Asia/Jerusalem" });
    const jsonSpy = vi.spyOn(request, "json");

    await POST(request);

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("authenticates before calling request.json() for an authenticated request", async () => {
    const callOrder: string[] = [];
    mocks.requireAuthenticatedUser.mockImplementation(async () => {
      callOrder.push("authenticate");
      return { outcome: "AUTHENTICATED", userId: "supabase-user-1" };
    });
    mocks.setUserTimezone.mockResolvedValue({ outcome: "UPDATED", timezone: "Asia/Jerusalem" });

    const request = makeRequest({ timezone: "Asia/Jerusalem" });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, "json").mockImplementation(async () => {
      callOrder.push("parse");
      return originalJson();
    });

    await POST(request);

    expect(callOrder).toEqual(["authenticate", "parse"]);
  });
});
