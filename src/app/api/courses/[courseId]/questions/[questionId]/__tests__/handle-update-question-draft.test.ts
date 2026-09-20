import { describe, expect, it, vi } from "vitest";

import { handleUpdateQuestionDraft } from "../handle-update-question-draft";

import type {
  UpdateQuestionDraftCommand,
  UpdateQuestionDraftResult,
} from "@/application/question/update-question-draft";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUESTION_ID = "223e4567-e89b-12d3-a456-426614174000";

describe("handleUpdateQuestionDraft", () => {
  it("unauthenticated: 401, never calls update", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { prompt: "Hi" },
      update,
    });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 QUESTION_NOT_FOUND, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      questionId: QUESTION_ID,
      body: {},
      update,
    });

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("malformed questionId: 404 QUESTION_NOT_FOUND, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: "not-a-uuid",
      body: {},
      update,
    });

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("null body: 400 INVALID_REQUEST, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: null,
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("wrong-typed prompt: 400 INVALID_REQUEST, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { prompt: 123 },
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("unknown questionType string: 400 INVALID_REQUEST, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { questionType: "TRUE_FALSE" },
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("malformed answerOptions (missing content): 400 INVALID_REQUEST, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { answerOptions: [{ id: "a" }] },
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("malformed correctOptionIds (non-string entry): 400 INVALID_REQUEST, update never called", async () => {
    const update = vi.fn();
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { correctOptionIds: [1, 2] },
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("passes only the fields present in the body through, leaving absent fields as undefined", async () => {
    const update = vi.fn(
      async (command: UpdateQuestionDraftCommand): Promise<UpdateQuestionDraftResult> => {
        void command; // asserted from update.mock.calls below, not here
        return {
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
        };
      },
    );
    await handleUpdateQuestionDraft({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { prompt: "Hi" },
      update,
    });

    const [command] = update.mock.calls[0];
    expect(command).toEqual({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      prompt: "Hi",
    });
  });

  it("passes an explicit null through (clears the field), distinct from an absent field", async () => {
    const update = vi.fn(
      async (command: UpdateQuestionDraftCommand): Promise<UpdateQuestionDraftResult> => {
        void command; // asserted from update.mock.calls below, not here
        return {
          outcome: "UPDATED",
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
        };
      },
    );
    await handleUpdateQuestionDraft({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { topicId: null },
      update,
    });

    const [command] = update.mock.calls[0];
    expect(command).toEqual({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      topicId: null,
    });
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const update = vi.fn(async (): Promise<UpdateQuestionDraftResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: {},
      update,
    });

    expect(response.status).toBe(403);
  });

  it("QUESTION_NOT_FOUND: 404", async () => {
    const update = vi.fn(async (): Promise<UpdateQuestionDraftResult> => ({ outcome: "QUESTION_NOT_FOUND" }));
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: {},
      update,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "QUESTION_NOT_FOUND" } });
  });

  it("TOPIC_NOT_FOUND: 404", async () => {
    const update = vi.fn(async (): Promise<UpdateQuestionDraftResult> => ({ outcome: "TOPIC_NOT_FOUND" }));
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { topicId: "topic-1" },
      update,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "TOPIC_NOT_FOUND" } });
  });

  it("TOPIC_ARCHIVED: 409", async () => {
    const update = vi.fn(async (): Promise<UpdateQuestionDraftResult> => ({ outcome: "TOPIC_ARCHIVED" }));
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { topicId: "topic-1" },
      update,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "TOPIC_ARCHIVED" } });
  });

  it("INVALID_DRAFT: 400 with the domain validator's own message", async () => {
    const update = vi.fn(
      async (): Promise<UpdateQuestionDraftResult> => ({
        outcome: "INVALID_DRAFT",
        message: 'duplicate option id "a"',
      }),
    );
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: {},
      update,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_DRAFT", message: 'duplicate option id "a"' } });
  });

  it("UPDATED: 200 with the mapped DTO", async () => {
    const update = vi.fn(
      async (): Promise<UpdateQuestionDraftResult> => ({
        outcome: "UPDATED",
        question: {
          id: QUESTION_ID,
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
      }),
    );
    const response = await handleUpdateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      body: { topicId: "topic-1", questionType: "SINGLE_CHOICE", prompt: "What is 2+2?" },
      update,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ question: { id: QUESTION_ID, state: "DRAFT_ONLY" } });
  });
});
