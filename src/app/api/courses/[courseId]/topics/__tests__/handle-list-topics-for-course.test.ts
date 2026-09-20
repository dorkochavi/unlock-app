import { describe, expect, it, vi } from "vitest";

import { handleListTopicsForCourse } from "../handle-list-topics-for-course";

import type { ListTopicsForCourseResult } from "@/application/topic/list-topics-for-course";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleListTopicsForCourse", () => {
  it("unauthenticated: 401, never calls listTopics", async () => {
    const listTopics = vi.fn();
    const response = await handleListTopicsForCourse({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      listTopics,
    });

    expect(response.status).toBe(401);
    expect(listTopics).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, listTopics never called", async () => {
    const listTopics = vi.fn();
    const response = await handleListTopicsForCourse({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      listTopics,
    });

    expect(response.status).toBe(404);
    expect(listTopics).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const listTopics = vi.fn(
      async (): Promise<ListTopicsForCourseResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    const response = await handleListTopicsForCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      listTopics,
    });

    expect(response.status).toBe(403);
  });

  it("READY: 200 with the mapped DTOs", async () => {
    const listTopics = vi.fn(
      async (): Promise<ListTopicsForCourseResult> => ({
        outcome: "READY",
        topics: [
          {
            id: "topic-1",
            courseId: COURSE_ID,
            name: "Algebra",
            archivedAt: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      }),
    );
    const response = await handleListTopicsForCourse({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      listTopics,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      topics: [
        {
          id: "topic-1",
          courseId: COURSE_ID,
          name: "Algebra",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(listTopics).toHaveBeenCalledWith({ actorUserId: "real-user", courseId: COURSE_ID });
  });
});
