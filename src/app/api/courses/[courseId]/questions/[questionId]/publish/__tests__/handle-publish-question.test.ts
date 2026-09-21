import { describe, expect, it, vi } from "vitest";

import { handlePublishQuestion } from "../handle-publish-question";

import type { PublishQuestionResult } from "@/application/question/publish-question";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUESTION_ID = "223e4567-e89b-12d3-a456-426614174000";

describe("handlePublishQuestion", () => {
  it("unauthenticated: 401, publish never called", async () => {
    const publish = vi.fn();
    const response = await handlePublishQuestion({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, publish never called", async () => {
    const publish = vi.fn();
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "QUESTION_NOT_FOUND" } });
    expect(publish).not.toHaveBeenCalled();
  });

  it("malformed questionId: 404, publish never called", async () => {
    const publish = vi.fn();
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: "not-a-uuid",
      publish,
    });

    expect(response.status).toBe(404);
    expect(publish).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const publish = vi.fn(async (): Promise<PublishQuestionResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(403);
  });

  it("QUESTION_NOT_FOUND: 404", async () => {
    const publish = vi.fn(async (): Promise<PublishQuestionResult> => ({ outcome: "QUESTION_NOT_FOUND" }));
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "QUESTION_NOT_FOUND" } });
  });

  it("COURSE_ARCHIVED: 409", async () => {
    const publish = vi.fn(async (): Promise<PublishQuestionResult> => ({ outcome: "COURSE_ARCHIVED" }));
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "COURSE_ARCHIVED" } });
  });

  it("NOTHING_TO_PUBLISH: 409", async () => {
    const publish = vi.fn(async (): Promise<PublishQuestionResult> => ({ outcome: "NOTHING_TO_PUBLISH" }));
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "NOTHING_TO_PUBLISH" } });
  });

  it("NOT_READY: 400 with the reason", async () => {
    const publish = vi.fn(
      async (): Promise<PublishQuestionResult> => ({ outcome: "NOT_READY", reason: "prompt must not be empty" }),
    );
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "NOT_READY", reason: "prompt must not be empty" } });
  });

  it("PUBLISHED: 200 with the DTO", async () => {
    const publish = vi.fn<
      (command: { actorUserId: string; courseId: string; questionId: string }) => Promise<PublishQuestionResult>
    >(async () => ({
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
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      }),
    );
    const response = await handlePublishQuestion({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      questionId: QUESTION_ID,
      publish,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ question: { state: "PUBLISHED" } });
    const [command] = publish.mock.calls[0];
    expect(command).toEqual({ actorUserId: "supabase-user-1", courseId: COURSE_ID, questionId: QUESTION_ID });
  });
});
