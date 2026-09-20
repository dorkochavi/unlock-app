import { describe, expect, it, vi } from "vitest";

import { handleCreateQuestionDraft } from "../handle-create-question-draft";

import type { CreateQuestionDraftResult } from "@/application/question/create-question-draft";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleCreateQuestionDraft", () => {
  it("unauthenticated: 401, never calls create", async () => {
    const create = vi.fn();
    const response = await handleCreateQuestionDraft({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      create,
    });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, create never called", async () => {
    const create = vi.fn();
    const response = await handleCreateQuestionDraft({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      create,
    });

    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const create = vi.fn(async (): Promise<CreateQuestionDraftResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleCreateQuestionDraft({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      create,
    });

    expect(response.status).toBe(403);
  });

  it("CREATED: 201 with the DTO (empty draft, no Topic, no current version), passing actor/courseId through", async () => {
    const create = vi.fn(
      async (): Promise<CreateQuestionDraftResult> => ({
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
      }),
    );
    const response = await handleCreateQuestionDraft({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      create,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ question: { id: "question-1", state: "DRAFT_ONLY" } });
    expect(create).toHaveBeenCalledWith({ actorUserId: "real-user", courseId: COURSE_ID });
  });
});
