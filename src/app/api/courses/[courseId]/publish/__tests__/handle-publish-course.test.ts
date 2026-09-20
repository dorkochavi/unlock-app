import { describe, expect, it, vi } from "vitest";

import { handlePublishCourse } from "../handle-publish-course";

import type { PublishCourseResult } from "@/application/course/publish-course";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handlePublishCourse", () => {
  it("unauthenticated: 401, never calls publish", async () => {
    const publish = vi.fn();
    const response = await handlePublishCourse({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      publish,
    });

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, publish never called", async () => {
    const publish = vi.fn();
    const response = await handlePublishCourse({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      publish,
    });

    expect(response.status).toBe(404);
    expect(publish).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const publish = vi.fn(async (): Promise<PublishCourseResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handlePublishCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      publish,
    });

    expect(response.status).toBe(403);
  });

  it("INVALID_TRANSITION: 409 with the from status", async () => {
    const publish = vi.fn(
      async (): Promise<PublishCourseResult> => ({ outcome: "INVALID_TRANSITION", from: "ARCHIVED" }),
    );
    const response = await handlePublishCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      publish,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "INVALID_TRANSITION", from: "ARCHIVED" } });
  });

  it("PUBLISHED: 200 with the DTO", async () => {
    const publish = vi.fn(
      async (): Promise<PublishCourseResult> => ({
        outcome: "PUBLISHED",
        course: {
          id: COURSE_ID,
          title: "Intro",
          status: "PUBLISHED",
          joinPolicy: "AUTHORIZED_ONLY",
          examDate: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      }),
    );
    const response = await handlePublishCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      publish,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ course: { status: "PUBLISHED" } });
  });
});
