/**
 * Auth-before-DB / auth-before-body ordering for `POST
 * /api/courses/:courseId/practice/answer`. Mocks only the infrastructure
 * modules `route.ts` imports and calls the REAL `POST`, so a regression that
 * builds the pool/ports (or parses the body) before authentication fails here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  createProductionPracticePorts: vi.fn(),
  createProductionPracticeSettings: vi.fn(),
  createProductionSubmitAnswerContext: vi.fn(),
  submitPracticeAnswer: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/infrastructure/postgres/pg-pool", () => ({ getPool: mocks.getPool }));
vi.mock("@/infrastructure/postgres/pg-connection-provider", () => ({
  PgConnectionProvider: mocks.PgConnectionProvider,
}));
vi.mock("@/infrastructure/practice/composition-root", () => ({
  createProductionPracticePorts: mocks.createProductionPracticePorts,
  createProductionPracticeSettings: mocks.createProductionPracticeSettings,
}));
vi.mock("@/infrastructure/learning/composition-root", () => ({
  createProductionSubmitAnswerContext: mocks.createProductionSubmitAnswerContext,
}));
vi.mock("@/application/practice/submit-practice-answer", () => ({
  submitPracticeAnswer: mocks.submitPracticeAnswer,
}));

import { POST } from "../route";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const Q = "323e4567-e89b-12d3-a456-426614174000";
const V = "423e4567-e89b-12d3-a456-426614174000";
const good = { questionId: Q, questionVersionId: V, submissionId: "sub-1", selectedAnswer: "A" };

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/courses/${COURSE}/practice/answer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const params = (courseId = COURSE) => ({ params: Promise.resolve({ courseId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseServerClient.mockResolvedValue({});
});

describe("POST practice/answer route ordering", () => {
  it("unauthenticated: 401, body never parsed, no pool/ports/submit", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = makeRequest(good);
    const jsonSpy = vi.spyOn(request, "json");

    const response = await POST(request, params());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.createProductionPracticePorts).not.toHaveBeenCalled();
    expect(mocks.submitPracticeAnswer).not.toHaveBeenCalled();
  });

  it("authenticated but malformed body: 400 with no DB construction", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    const response = await POST(makeRequest({}), params());
    expect(response.status).toBe(400);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.submitPracticeAnswer).not.toHaveBeenCalled();
  });

  it("authenticated, malformed courseId: 404 with no DB construction", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    const response = await POST(makeRequest(good), params("nope"));
    expect(response.status).toBe(404);
    expect(mocks.getPool).not.toHaveBeenCalled();
  });

  it("authenticated + well-formed: DB wiring reached once, with the authenticated user and a server-captured now", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    const fakePool = { marker: "pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.submitPracticeAnswer.mockResolvedValue({
      kind: "ACCEPTED",
      isCorrect: true,
      wasIdempotentRetry: false,
    });

    const response = await POST(
      makeRequest({ ...good, userId: "attacker", answeredAt: "1999-01-01T00:00:00Z" }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isCorrect: true });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.createProductionPracticePorts).toHaveBeenCalledTimes(1);
    const [command] = mocks.submitPracticeAnswer.mock.calls[0];
    expect(command.userId).toBe("u1");
    expect(command.courseId).toBe(COURSE);
    expect(command.now).toBeInstanceOf(Date);
    expect(command.now.getFullYear()).toBeGreaterThan(2000);
    expect(command).not.toHaveProperty("answeredAt");
  });

  it("DB construction failure: 500 INTERNAL_ERROR, no secret leaked", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u1" });
    mocks.getPool.mockImplementation(() => {
      throw new Error("DATABASE_URL postgres://secret-user:hunter2@host/db");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(makeRequest(good), params());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    spy.mockRestore();
  });

  it("failure before authentication (client creation): 500, auth and DB never reached", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(new Error("missing env"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(makeRequest(good), params());
    expect(response.status).toBe(500);
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
