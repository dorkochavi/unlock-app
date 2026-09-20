import { describe, expect, it, vi } from "vitest";

import { handleArchiveTopic } from "../handle-archive-topic";

import type { ArchiveTopicResult } from "@/application/topic/archive-topic";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC_ID = "223e4567-e89b-12d3-a456-426614174000";

describe("handleArchiveTopic", () => {
  it("unauthenticated: 401, never calls archive", async () => {
    const archive = vi.fn();
    const response = await handleArchiveTopic({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      archive,
    });

    expect(response.status).toBe(401);
    expect(archive).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 TOPIC_NOT_FOUND, archive never called", async () => {
    const archive = vi.fn();
    const response = await handleArchiveTopic({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      topicId: TOPIC_ID,
      archive,
    });

    expect(response.status).toBe(404);
    expect(archive).not.toHaveBeenCalled();
  });

  it("malformed topicId: 404 TOPIC_NOT_FOUND, archive never called", async () => {
    const archive = vi.fn();
    const response = await handleArchiveTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: "not-a-uuid",
      archive,
    });

    expect(response.status).toBe(404);
    expect(archive).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const archive = vi.fn(async (): Promise<ArchiveTopicResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleArchiveTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      archive,
    });

    expect(response.status).toBe(403);
  });

  it("TOPIC_NOT_FOUND: 404 (covers both nonexistent and cross-Course mismatch)", async () => {
    const archive = vi.fn(async (): Promise<ArchiveTopicResult> => ({ outcome: "TOPIC_NOT_FOUND" }));
    const response = await handleArchiveTopic({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      archive,
    });

    expect(response.status).toBe(404);
  });

  it("ARCHIVED: 200 with the DTO, passing actor/courseId/topicId through", async () => {
    const archive = vi.fn(
      async (): Promise<ArchiveTopicResult> => ({
        outcome: "ARCHIVED",
        topic: {
          id: TOPIC_ID,
          courseId: COURSE_ID,
          name: "Algebra",
          archivedAt: new Date("2026-01-03T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-03T00:00:00Z"),
        },
      }),
    );
    const response = await handleArchiveTopic({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
      archive,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ topic: { id: TOPIC_ID } });
    expect(archive).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      topicId: TOPIC_ID,
    });
  });
});
