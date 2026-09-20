/**
 * Auth-before-DB ordering regression for
 * `GET/POST /api/courses/:courseId/questions`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  PostgresQuestionRepository: vi.fn(),
  listQuestionsForCourse: vi.fn(),
  createQuestionDraft: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/infrastructure/postgres/pg-pool", () => ({ getPool: mocks.getPool }));
vi.mock("@/infrastructure/postgres/course-membership-repository", () => ({
  PostgresCourseMembershipRepository: mocks.PostgresCourseMembershipRepository,
}));
vi.mock("@/infrastructure/postgres/topic-repository", () => ({
  PostgresTopicRepository: mocks.PostgresTopicRepository,
}));
vi.mock("@/infrastructure/postgres/question-authoring-repository", () => ({
  PostgresQuestionRepository: mocks.PostgresQuestionRepository,
}));
vi.mock("@/application/question/list-questions-for-course", () => ({
  listQuestionsForCourse: mocks.listQuestionsForCourse,
}));
vi.mock("@/application/question/create-question-draft", () => ({
  createQuestionDraft: mocks.createQuestionDraft,
}));

import { GET, POST } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

describe("GET/POST /api/courses/:courseId/questions — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("GET unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/questions"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.listQuestionsForCourse).not.toHaveBeenCalled();
  });

  it("GET authenticated: reaches real DB construction wiring", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.listQuestionsForCourse.mockResolvedValue({
      outcome: "LISTED",
      questions: [],
      publishedPromptByQuestionId: {},
      topicById: {},
    });

    const response = await GET(
      new Request("http://localhost/api/courses/x/questions"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresQuestionRepository).toHaveBeenCalledWith(fakePool);
  });

  it("POST unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      new Request("http://localhost/api/courses/x/questions", { method: "POST" }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.createQuestionDraft).not.toHaveBeenCalled();
  });

  it("POST authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.createQuestionDraft.mockResolvedValue({
      outcome: "CREATED",
      question: {
        id: "question-1",
        courseId: COURSE_ID,
        topicId: null,
        currentVersionId: null,
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
      new Request("http://localhost/api/courses/x/questions", { method: "POST" }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(201);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.createQuestionDraft.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
  });
});
