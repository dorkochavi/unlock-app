/**
 * Regression coverage for the same auth-before-DB ordering property
 * `daily-plan/today/__tests__/route-auth-db-ordering.test.ts` and
 * `user/timezone/__tests__/route-auth-db-ordering.test.ts` protect, applied
 * to `POST /api/daily-plan/items/:itemId/answer`: `getPool()`/
 * `PostgresDailyPlanRepository`/`PostgresUnitOfWork` construction must be
 * structurally unreachable for an unauthenticated OR malformed request.
 *
 * Mocks ONLY the infrastructure/application modules `route.ts` itself
 * imports, then imports and calls the REAL `POST` export from `../route` —
 * so these assertions exercise `route.ts`'s actual closure/control flow,
 * not a re-description of it. `submitDailyPlanItemAnswer` itself is mocked
 * (its own internal logic is covered by
 * `application/dailyPlan/__tests__/submit-daily-plan-item-answer.test.ts`
 * and `application/learning/__tests__/submit-answer.test.ts`) — this file
 * verifies WIRING/ORDERING only.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  PostgresDailyPlanRepository: vi.fn(),
  PostgresUnitOfWork: vi.fn(),
  createProductionSubmitAnswerContext: vi.fn(),
  submitDailyPlanItemAnswer: vi.fn(),
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

vi.mock("@/infrastructure/postgres/daily-plan-repository", () => ({
  PostgresDailyPlanRepository: mocks.PostgresDailyPlanRepository,
}));

vi.mock("@/infrastructure/postgres/postgres-unit-of-work", () => ({
  PostgresUnitOfWork: mocks.PostgresUnitOfWork,
}));

vi.mock("@/infrastructure/learning/composition-root", () => ({
  createProductionSubmitAnswerContext: mocks.createProductionSubmitAnswerContext,
}));

vi.mock("@/application/dailyPlan/submit-daily-plan-item-answer", () => ({
  submitDailyPlanItemAnswer: mocks.submitDailyPlanItemAnswer,
}));

// `vi.mock` calls above are hoisted above this import by Vitest, so `POST`
// here is the real production route, wired against the mocks above.
import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/daily-plan/items/item-1/answer", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeParams(itemId: string): { params: Promise<{ itemId: string }> } {
  return { params: Promise.resolve({ itemId }) };
}

describe("POST /api/daily-plan/items/:itemId/answer — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("A. unauthenticated: 401, getPool/repository/unit-of-work construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      makeRequest({ submissionId: "sub-1", selectedAnswer: "A" }),
      makeParams("item-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresDailyPlanRepository).not.toHaveBeenCalled();
    expect(mocks.PostgresUnitOfWork).not.toHaveBeenCalled();
    expect(mocks.submitDailyPlanItemAnswer).not.toHaveBeenCalled();
  });

  it("B. authenticated but malformed body: 400, getPool/repository/unit-of-work construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });

    const response = await POST(makeRequest({}), makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresDailyPlanRepository).not.toHaveBeenCalled();
    expect(mocks.PostgresUnitOfWork).not.toHaveBeenCalled();
  });

  it("C. authenticated with a well-formed body: real DB construction wiring is reached, exactly once, with the URL itemId and authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.submitDailyPlanItemAnswer.mockResolvedValue({
      kind: "ACCEPTED",
      attempt: { isCorrect: true },
      progress: {},
      wasIdempotentRetry: false,
      wasReconciledViaRebuild: false,
    });

    const response = await POST(
      makeRequest({ submissionId: "sub-1", selectedAnswer: "A" }),
      makeParams("item-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "COMPLETED", isCorrect: true, wasIdempotentRetry: false });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresDailyPlanRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.PostgresUnitOfWork).toHaveBeenCalledTimes(1);
    expect(mocks.submitDailyPlanItemAnswer).toHaveBeenCalledTimes(1);

    const [command] = mocks.submitDailyPlanItemAnswer.mock.calls[0];
    expect(command.userId).toBe("supabase-user-1");
    expect(command.dailyPlanItemId).toBe("item-1");
    expect(command.submissionId).toBe("sub-1");
    expect(command.assistanceUsed).toBe("NONE");
    expect(command.answerWasRevealedBeforeResponse).toBe(false);
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

    const response = await POST(
      makeRequest({ submissionId: "sub-1", selectedAnswer: "A" }),
      makeParams("item-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("hunter2");

    consoleErrorSpy.mockRestore();
  });

  it("E. route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error(
        "createSupabaseServerClient(): NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set.",
      ),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      makeRequest({ submissionId: "sub-1", selectedAnswer: "A" }),
      makeParams("item-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("F. malformed JSON body: treated as a 400, never reaches auth-gated DB construction", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const malformedRequest = new Request(
      "http://localhost/api/daily-plan/items/item-1/answer",
      { method: "POST", body: "{not valid json", headers: { "content-type": "application/json" } },
    );

    const response = await POST(malformedRequest, makeParams("item-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
  });
});

describe("POST /api/daily-plan/items/:itemId/answer — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = makeRequest({ submissionId: "sub-1", selectedAnswer: "A" });
    const jsonSpy = vi.spyOn(request, "json");

    await POST(request, makeParams("item-1"));

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("authenticates before calling request.json() for an authenticated request", async () => {
    const callOrder: string[] = [];
    mocks.requireAuthenticatedUser.mockImplementation(async () => {
      callOrder.push("authenticate");
      return { outcome: "AUTHENTICATED", userId: "supabase-user-1" };
    });
    mocks.submitDailyPlanItemAnswer.mockResolvedValue({
      kind: "ACCEPTED",
      attempt: { isCorrect: true },
      progress: {},
      wasIdempotentRetry: false,
      wasReconciledViaRebuild: false,
    });

    const request = makeRequest({ submissionId: "sub-1", selectedAnswer: "A" });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, "json").mockImplementation(async () => {
      callOrder.push("parse");
      return originalJson();
    });

    await POST(request, makeParams("item-1"));

    expect(callOrder).toEqual(["authenticate", "parse"]);
  });
});
