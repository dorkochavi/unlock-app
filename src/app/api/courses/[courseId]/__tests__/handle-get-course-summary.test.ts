/**
 * Unit tests for `handleGetCourseSummary` — the testable core of the
 * PUBLIC `GET /api/courses/:courseId`. No auth boundary applies (see the
 * handler's own doc comment for why); every dependency is faked.
 */
import { describe, expect, it, vi } from "vitest";

import type { CourseSummary } from "../../../../../application/course/ports";
import { handleGetCourseSummary } from "../handle-get-course-summary";

describe("handleGetCourseSummary", () => {
  it("found: 200 with only {id, title} — no owner/join-policy/timestamp fields", async () => {
    const getSummary = vi.fn(
      async (): Promise<CourseSummary | null> => ({ id: "course-1", title: "Advanced Calculus" }),
    );

    const response = await handleGetCourseSummary({ courseId: "course-1", getSummary });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ course: { id: "course-1", title: "Advanced Calculus" } });
    expect(Object.keys((response.body as { course: object }).course).sort()).toEqual([
      "id",
      "title",
    ]);
  });

  it("not found: 404 COURSE_NOT_FOUND", async () => {
    const getSummary = vi.fn(async (): Promise<CourseSummary | null> => null);

    const response = await handleGetCourseSummary({ courseId: "does-not-exist", getSummary });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "COURSE_NOT_FOUND" } });
  });

  it("unexpected thrown error: stable 500, no raw error/database details leaked", async () => {
    const getSummary = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetCourseSummary({ courseId: "course-1", getSummary });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");

    consoleErrorSpy.mockRestore();
  });

  it("uses the courseId passed in, never anything else", async () => {
    const getSummary = vi.fn(async (): Promise<CourseSummary | null> => null);

    await handleGetCourseSummary({ courseId: "the-exact-id", getSummary });

    expect(getSummary).toHaveBeenCalledWith("the-exact-id");
  });
});
