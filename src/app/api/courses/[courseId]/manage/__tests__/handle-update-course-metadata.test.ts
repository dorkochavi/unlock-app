import { describe, expect, it, vi } from "vitest";

import { handleUpdateCourseMetadata } from "../handle-update-course-metadata";

import type { UpdateCourseMetadataResult } from "@/application/course/update-course-metadata";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function fakeCourse(overrides: Partial<{ title: string; examDate: string | null }> = {}) {
  return {
    id: COURSE_ID,
    title: overrides.title ?? "Intro",
    status: "DRAFT" as const,
    joinPolicy: "AUTHORIZED_ONLY" as const,
    examDate: overrides.examDate ?? null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
}

describe("handleUpdateCourseMetadata", () => {
  it("unauthenticated: 401, never calls update", async () => {
    const update = vi.fn();
    const response = await handleUpdateCourseMetadata({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      body: { title: "New" },
      update,
    });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND", async () => {
    const update = vi.fn();
    const response = await handleUpdateCourseMetadata({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      body: { title: "New" },
      update,
    });

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("omits absent fields from the command — title-only patch does not send examDate", async () => {
    const update = vi.fn(
      async (): Promise<UpdateCourseMetadataResult> => ({ outcome: "UPDATED", course: fakeCourse() }),
    );

    await handleUpdateCourseMetadata({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { title: "New Title" },
      update,
    });

    expect(update).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      title: "New Title",
    });
  });

  it("passes examDate: null through explicitly to clear it", async () => {
    const update = vi.fn(
      async (): Promise<UpdateCourseMetadataResult> => ({ outcome: "UPDATED", course: fakeCourse() }),
    );

    await handleUpdateCourseMetadata({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { examDate: null },
      update,
    });

    expect(update).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      examDate: null,
    });
  });

  it("malformed examDate: 400 INVALID_REQUEST", async () => {
    const update = vi.fn();
    const response = await handleUpdateCourseMetadata({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { examDate: "not-a-date" },
      update,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const update = vi.fn(
      async (): Promise<UpdateCourseMetadataResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    const response = await handleUpdateCourseMetadata({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { title: "New" },
      update,
    });

    expect(response.status).toBe(403);
  });

  it("UPDATED: 200 with the DTO", async () => {
    const update = vi.fn(
      async (): Promise<UpdateCourseMetadataResult> => ({
        outcome: "UPDATED",
        course: fakeCourse({ title: "New Title" }),
      }),
    );
    const response = await handleUpdateCourseMetadata({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { title: "New Title" },
      update,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ course: { title: "New Title" } });
  });
});
