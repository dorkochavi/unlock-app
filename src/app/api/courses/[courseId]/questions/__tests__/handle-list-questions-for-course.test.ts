import { describe, expect, it, vi } from "vitest";

import { handleListQuestionsForCourse } from "../handle-list-questions-for-course";

import type { ListQuestionsForCourseResult } from "@/application/question/list-questions-for-course";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleListQuestionsForCourse", () => {
  it("unauthenticated: 401, never calls listQuestions", async () => {
    const listQuestions = vi.fn();
    const response = await handleListQuestionsForCourse({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      listQuestions,
    });

    expect(response.status).toBe(401);
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, listQuestions never called", async () => {
    const listQuestions = vi.fn();
    const response = await handleListQuestionsForCourse({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      listQuestions,
    });

    expect(response.status).toBe(404);
    expect(listQuestions).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const listQuestions = vi.fn(
      async (): Promise<ListQuestionsForCourseResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    const response = await handleListQuestionsForCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      listQuestions,
    });

    expect(response.status).toBe(403);
  });

  it("LISTED: 200 with the mapped DTOs, including computed state", async () => {
    const listQuestions = vi.fn(
      async (): Promise<ListQuestionsForCourseResult> => ({
        outcome: "LISTED",
        questions: [
          {
            id: "question-1",
            courseId: COURSE_ID,
            topicId: "topic-1",
            currentVersionId: null,
            draft: {
              questionType: "SINGLE_CHOICE",
              prompt: "What is 2+2?",
              answerOptions: [
                { id: "a", content: "3" },
                { id: "b", content: "4" },
              ],
              correctOptionIds: ["b"],
              explanation: null,
            },
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
        publishedPromptByQuestionId: {},
        topicById: {
          "topic-1": {
            id: "topic-1",
            courseId: COURSE_ID,
            name: "Algebra",
            archivedAt: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        },
      }),
    );
    const response = await handleListQuestionsForCourse({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      listQuestions,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      questions: [
        {
          id: "question-1",
          courseId: COURSE_ID,
          topicId: "topic-1",
          state: "DRAFT_ONLY",
          draft: {
            questionType: "SINGLE_CHOICE",
            prompt: "What is 2+2?",
            answerOptions: [
              { id: "a", content: "3" },
              { id: "b", content: "4" },
            ],
            correctOptionIds: ["b"],
            explanation: null,
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      publishedPromptByQuestionId: {},
      topicById: {
        "topic-1": { id: "topic-1", name: "Algebra", archivedAt: null },
      },
    });
    expect(listQuestions).toHaveBeenCalledWith({ actorUserId: "real-user", courseId: COURSE_ID });
  });

  it("LISTED: includes publishedPromptByQuestionId for a PUBLISHED Question with no pending draft, and an archived Topic's own entry in topicById", async () => {
    const listQuestions = vi.fn(
      async (): Promise<ListQuestionsForCourseResult> => ({
        outcome: "LISTED",
        questions: [
          {
            id: "question-1",
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
        ],
        publishedPromptByQuestionId: { "question-1": "What is the real published prompt?" },
        topicById: {
          "topic-1": {
            id: "topic-1",
            courseId: COURSE_ID,
            name: "Algebra",
            archivedAt: new Date("2026-02-01T00:00:00Z"),
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-02-01T00:00:00Z"),
          },
        },
      }),
    );
    const response = await handleListQuestionsForCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      listQuestions,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      publishedPromptByQuestionId: { "question-1": "What is the real published prompt?" },
      topicById: { "topic-1": { id: "topic-1", name: "Algebra", archivedAt: "2026-02-01T00:00:00.000Z" } },
    });
  });
});
