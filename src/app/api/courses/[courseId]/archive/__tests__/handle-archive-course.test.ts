import { describe, expect, it, vi } from "vitest";

import { handleArchiveCourse } from "../handle-archive-course";

import type { ArchiveCourseResult } from "@/application/course/archive-course";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleArchiveCourse", () => {
  it("unauthenticated: 401, never calls archive", async () => {
    const archive = vi.fn();
    const response = await handleArchiveCourse({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      archive,
    });

    expect(response.status).toBe(401);
    expect(archive).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, archive never called", async () => {
    const archive = vi.fn();
    const response = await handleArchiveCourse({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      archive,
    });

    expect(response.status).toBe(404);
    expect(archive).not.toHaveBeenCalled();
  });

  it("INVALID_TRANSITION: 409 with the from status", async () => {
    const archive = vi.fn(
      async (): Promise<ArchiveCourseResult> => ({ outcome: "INVALID_TRANSITION", from: "ARCHIVED" }),
    );
    const response = await handleArchiveCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      archive,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "INVALID_TRANSITION", from: "ARCHIVED" } });
  });

  it("ARCHIVED: 200 with the DTO", async () => {
    const archive = vi.fn(
      async (): Promise<ArchiveCourseResult> => ({
        outcome: "ARCHIVED",
        course: {
          id: COURSE_ID,
          title: "Intro",
          status: "ARCHIVED",
          joinPolicy: "AUTHORIZED_ONLY",
          examDate: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      }),
    );
    const response = await handleArchiveCourse({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      archive,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ course: { status: "ARCHIVED" } });
  });
});
