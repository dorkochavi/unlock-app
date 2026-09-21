/**
 * Auth-before-DB ordering regression for
 * `GET/PATCH /api/courses/:courseId/questions/:questionId`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  PostgresQuestionRepository: vi.fn(),
  getQuestionForAuthoring: vi.fn(),
  updateQuestionDraft: vi.fn(),
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
vi.mock("@/application/question/get-question-for-authoring", () => ({
  getQuestionForAuthoring: mocks.getQuestionForAuthoring,
}));
vi.mock("@/application/question/update-question-draft", () => ({
  updateQuestionDraft: mocks.updateQuestionDraft,
}));

import { GET, PATCH } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUESTION_ID = "223e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string, questionId: string) {
  return { params: Promise.resolve({ courseId, questionId }) };
}

describe("GET/PATCH /api/courses/:courseId/questions/:questionId — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("GET unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/questions/y"),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.getQuestionForAuthoring).not.toHaveBeenCalled();
  });

  it("GET authenticated: reaches real DB construction wiring", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.getQuestionForAuthoring.mockResolvedValue({
      outcome: "FOUND",
      question: {
        id: QUESTION_ID,
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
      publishedContent: null,
      topic: null,
    });

    const response = await GET(
      new Request("http://localhost/api/courses/x/questions/y"),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresQuestionRepository).toHaveBeenCalledWith(fakePool);
  });

  it("PATCH unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/questions/y", {
        method: "PATCH",
        body: JSON.stringify({ prompt: "Hi" }),
      }),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.updateQuestionDraft).not.toHaveBeenCalled();
  });

  it("PATCH authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.updateQuestionDraft.mockResolvedValue({
      outcome: "UPDATED",
      question: {
        id: QUESTION_ID,
        courseId: COURSE_ID,
        topicId: null,
        currentVersionId: null,
        draft: {
          questionType: null,
          prompt: "Hi",
          answerOptions: null,
          correctOptionIds: null,
          explanation: null,
        },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/questions/y", {
        method: "PATCH",
        body: JSON.stringify({ prompt: "Hi" }),
      }),
      makeParams(COURSE_ID, QUESTION_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.updateQuestionDraft.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
    expect(command.questionId).toBe(QUESTION_ID);
  });
});

describe("PATCH /api/courses/:courseId/questions/:questionId — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = new Request("http://localhost/api/courses/x/questions/y", {
      method: "PATCH",
      body: JSON.stringify({ prompt: "Hi" }),
    });
    const jsonSpy = vi.spyOn(request, "json");

    await PATCH(request, makeParams(COURSE_ID, QUESTION_ID));

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("authenticates before calling request.json() for an authenticated request", async () => {
    const callOrder: string[] = [];
    mocks.requireAuthenticatedUser.mockImplementation(async () => {
      callOrder.push("authenticate");
      return { outcome: "AUTHENTICATED", userId: "supabase-user-1" };
    });
    mocks.updateQuestionDraft.mockResolvedValue({
      outcome: "UPDATED",
      question: {
        id: QUESTION_ID,
        courseId: COURSE_ID,
        topicId: null,
        currentVersionId: null,
        draft: { questionType: null, prompt: "Hi", answerOptions: null, correctOptionIds: null, explanation: null },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const request = new Request("http://localhost/api/courses/x/questions/y", {
      method: "PATCH",
      body: JSON.stringify({ prompt: "Hi" }),
    });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, "json").mockImplementation(async () => {
      callOrder.push("parse");
      return originalJson();
    });

    await PATCH(request, makeParams(COURSE_ID, QUESTION_ID));

    expect(callOrder).toEqual(["authenticate", "parse"]);
  });
});
