import { describe, expect, it, vi } from "vitest";

import { handleCreateTopic } from "../handle-create-topic";

import type { CreateTopicResult } from "@/application/topic/create-topic";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleCreateTopic", () => {
  it("unauthenticated: 401, never calls create", async () => {
    const create = vi.fn();
    const response = await handleCreateTopic({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      body: { name: "Algebra" },
      create,
    });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, create never called", async () => {
    const create = vi.fn();
    const response = await handleCreateTopic({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      body: { name: "Algebra" },
      create,
    });

    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("missing name: 400 INVALID_REQUEST, create never called", async () => {
    const create = vi.fn();
    const response = await handleCreateTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: {},
      create,
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("malformed body: 400 INVALID_REQUEST", async () => {
    const create = vi.fn();
    const response = await handleCreateTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: null,
      create,
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const create = vi.fn(async (): Promise<CreateTopicResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleCreateTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { name: "Algebra" },
      create,
    });

    expect(response.status).toBe(403);
  });

  it("INVALID_NAME: 400 INVALID_REQUEST", async () => {
    const create = vi.fn(async (): Promise<CreateTopicResult> => ({ outcome: "INVALID_NAME" }));
    const response = await handleCreateTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { name: "   " },
      create,
    });

    expect(response.status).toBe(400);
  });

  it("CREATED: 201 with the DTO, passing actor/courseId/name through", async () => {
    const create = vi.fn(
      async (): Promise<CreateTopicResult> => ({
        outcome: "CREATED",
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
    const response = await handleCreateTopic({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { name: "Algebra" },
      create,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ topic: { id: "topic-1", name: "Algebra" } });
    expect(create).toHaveBeenCalledWith({ actorUserId: "real-user", courseId: COURSE_ID, name: "Algebra" });
  });
});
