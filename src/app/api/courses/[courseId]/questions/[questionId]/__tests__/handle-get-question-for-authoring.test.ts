import { describe, expect, it, vi } from "vitest";

import { handleGetQuestionForAuthoring } from "../handle-get-question-for-authoring";

import type { GetQuestionForAuthoringResult } from "@/application/question/get-question-for-authoring";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUESTION_ID = "223e4567-e89b-12d3-a456-426614174000";

describe("handleGetQuestionForAuthoring", () => {
  it("unauthenticated: 401, never calls get", async () => {
    const get = vi.fn();
    const response = await handleGetQuestionForAuthoring({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 QUESTION_NOT_FOUND, get never called", async () => {
    const get = vi.fn();
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "QUESTION_NOT_FOUND" } });
    expect(get).not.toHaveBeenCalled();
  });

  it("malformed questionId: 404 QUESTION_NOT_FOUND, get never called", async () => {
    const get = vi.fn();
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: "not-a-uuid",
      get,
    });

    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const get = vi.fn(async (): Promise<GetQuestionForAuthoringResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(403);
  });

  it("QUESTION_NOT_FOUND: 404 (covers both nonexistent and cross-Course mismatch)", async () => {
    const get = vi.fn(async (): Promise<GetQuestionForAuthoringResult> => ({ outcome: "QUESTION_NOT_FOUND" }));
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "QUESTION_NOT_FOUND" } });
  });

  it("FOUND: 200 with the mapped DTO and null publishedContent (never published), passing actor/courseId/questionId through", async () => {
    const get = vi.fn(
      async (): Promise<GetQuestionForAuthoringResult> => ({
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
      }),
    );
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      question: { id: QUESTION_ID, state: "DRAFT_ONLY" },
      publishedContent: null,
      topic: null,
    });
    expect(get).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
    });
  });

  it("FOUND: 200 includes publishedContent's full content when the Question has a current version", async () => {
    const get = vi.fn(
      async (): Promise<GetQuestionForAuthoringResult> => ({
        outcome: "FOUND",
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
        publishedContent: {
          questionType: "SINGLE_CHOICE",
          prompt: "What is 2+2?",
          answerOptions: [
            { id: "a", content: "3" },
            { id: "b", content: "4" },
          ],
          correctOptionIds: ["b"],
          explanation: null,
        },
        topic: {
          id: "topic-1",
          courseId: COURSE_ID,
          name: "Algebra",
          archivedAt: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      question: { id: QUESTION_ID, state: "PUBLISHED" },
      publishedContent: { questionType: "SINGLE_CHOICE", prompt: "What is 2+2?", correctOptionIds: ["b"] },
      topic: { id: "topic-1", name: "Algebra", archivedAt: null },
    });
  });

  it("FOUND: 200 includes an archived Topic's own entry (Run 006 S1 decision #10 — no forced reassociation)", async () => {
    const get = vi.fn(
      async (): Promise<GetQuestionForAuthoringResult> => ({
        outcome: "FOUND",
        question: {
          id: QUESTION_ID,
          courseId: COURSE_ID,
          topicId: "topic-1",
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
        topic: {
          id: "topic-1",
          courseId: COURSE_ID,
          name: "Algebra",
          archivedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    );
    const response = await handleGetQuestionForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      get,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      topic: { id: "topic-1", name: "Algebra", archivedAt: "2026-02-01T00:00:00.000Z" },
    });
  });
});
