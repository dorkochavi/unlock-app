import { describe, expect, it, vi } from "vitest";

import { handleGetCourseForAuthoring } from "../handle-get-course-for-authoring";

import type { GetCourseForAuthoringResult } from "@/application/course/get-course-for-authoring";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleGetCourseForAuthoring", () => {
  it("unauthenticated: 401, never calls getCourse", async () => {
    const getCourse = vi.fn();
    const response = await handleGetCourseForAuthoring({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      getCourse,
    });

    expect(response.status).toBe(401);
    expect(getCourse).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, getCourse never called", async () => {
    const getCourse = vi.fn();
    const response = await handleGetCourseForAuthoring({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      getCourse,
    });

    expect(response.status).toBe(404);
    expect(getCourse).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const getCourse = vi.fn(
      async (): Promise<GetCourseForAuthoringResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    const response = await handleGetCourseForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getCourse,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: "NOT_AUTHORIZED" } });
  });

  it("READY: 200 with the DTO", async () => {
    const getCourse = vi.fn(
      async (): Promise<GetCourseForAuthoringResult> => ({
        outcome: "READY",
        course: {
          id: COURSE_ID,
          title: "Intro",
          status: "DRAFT",
          joinPolicy: "AUTHORIZED_ONLY",
          examDate: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const response = await handleGetCourseForAuthoring({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getCourse,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ course: { id: COURSE_ID, status: "DRAFT" } });
  });
});
