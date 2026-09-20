import { describe, expect, it, vi } from "vitest";

import { handleRenameTopic } from "../handle-rename-topic";

import type { RenameTopicResult } from "@/application/topic/rename-topic";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC_ID = "223e4567-e89b-12d3-a456-426614174000";

describe("handleRenameTopic", () => {
  it("unauthenticated: 401, never calls rename", async () => {
    const rename = vi.fn();
    const response = await handleRenameTopic({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(401);
    expect(rename).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 TOPIC_NOT_FOUND, rename never called", async () => {
    const rename = vi.fn();
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      topicId: TOPIC_ID,
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(404);
    expect(rename).not.toHaveBeenCalled();
  });

  it("malformed topicId: 404 TOPIC_NOT_FOUND, rename never called", async () => {
    const rename = vi.fn();
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: "not-a-uuid",
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(404);
    expect(rename).not.toHaveBeenCalled();
  });

  it("missing name: 400 INVALID_REQUEST, rename never called", async () => {
    const rename = vi.fn();
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: {},
      rename,
    });

    expect(response.status).toBe(400);
    expect(rename).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const rename = vi.fn(async (): Promise<RenameTopicResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(403);
  });

  it("TOPIC_NOT_FOUND: 404 (covers both nonexistent and cross-Course mismatch)", async () => {
    const rename = vi.fn(async (): Promise<RenameTopicResult> => ({ outcome: "TOPIC_NOT_FOUND" }));
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "TOPIC_NOT_FOUND" } });
  });

  it("INVALID_NAME: 400 INVALID_REQUEST", async () => {
    const rename = vi.fn(async (): Promise<RenameTopicResult> => ({ outcome: "INVALID_NAME" }));
    const response = await handleRenameTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: { name: "   " },
      rename,
    });

    expect(response.status).toBe(400);
  });

  it("RENAMED: 200 with the DTO, passing actor/courseId/topicId/name through", async () => {
    const rename = vi.fn(
      async (): Promise<RenameTopicResult> => ({
        outcome: "RENAMED",
        topic: {
          id: TOPIC_ID,
          courseId: COURSE_ID,
          name: "Renamed",
          archivedAt: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      }),
    );
    const response = await handleRenameTopic({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      body: { name: "Renamed" },
      rename,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ topic: { id: TOPIC_ID, name: "Renamed" } });
    expect(rename).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      name: "Renamed",
    });
  });
});
