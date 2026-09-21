/**
 * Auth-before-DB ordering regression for
 * `POST /api/courses/:courseId/questions/:questionId/publish`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  PostgresQuestionUnitOfWork: vi.fn(),
  publishQuestion: vi.fn(),
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
vi.mock("@/infrastructure/postgres/postgres-question-unit-of-work", () => ({
  PostgresQuestionUnitOfWork: mocks.PostgresQuestionUnitOfWork,
}));
vi.mock("@/application/question/publish-question", () => ({ publishQuestion: mocks.publishQuestion }));

import { POST } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUESTION_ID = "223e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string, questionId: string) {
  return { params: Promise.resolve({ courseId, questionId }) };
}

describe("POST /api/courses/:courseId/questions/:questionId/publish — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      new Request("http://localhost/api/courses/x/questions/y/publish", { method: "POST" }),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.publishQuestion).not.toHaveBeenCalled();
  });

  it("authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.publishQuestion.mockResolvedValue({
      outcome: "PUBLISHED",
      versionId: "version-1",
      question: {
        id: QUESTION_ID,
        courseId: COURSE_ID,
        topicId: "topic-1",
        currentVersionId: "version-1",
        draft: {
          questionType: null,
          prompt: null,
          answerOptions: null,
          correctOptionIds: null,
          explanation: null,
        },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/courses/x/questions/y/publish", { method: "POST" }),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresQuestionUnitOfWork).toHaveBeenCalledTimes(1);
    const [command] = mocks.publishQuestion.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
    expect(command.questionId).toBe(QUESTION_ID);
  });
});
