import { describe, expect, it, vi } from "vitest";

import { handleGetCourseContext } from "../handle-get-course-context";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleGetCourseContext", () => {
  it("returns 401 when unauthenticated, without calling getContext", async () => {
    const getContext = vi.fn();

    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: VALID_UUID,
      getContext,
    });

    expect(result).toEqual({ status: 401, body: { error: { code: "UNAUTHENTICATED" } } });
    expect(getContext).not.toHaveBeenCalled();
  });

  it("returns 404 COURSE_NOT_FOUND for a malformed courseId without calling getContext", async () => {
    const getContext = vi.fn();

    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: "not-a-uuid",
      getContext,
    });

    expect(result).toEqual({ status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } });
    expect(getContext).not.toHaveBeenCalled();
  });

  it("returns 404 COURSE_NOT_FOUND for a well-formed but nonexistent course", async () => {
    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => ({ outcome: "COURSE_NOT_FOUND" }),
    });

    expect(result).toEqual({ status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } });
  });

  it("returns 403 NOT_AUTHORIZED for an authenticated non-member", async () => {
    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => ({ outcome: "NOT_A_MEMBER" }),
    });

    expect(result).toEqual({ status: 403, body: { error: { code: "NOT_AUTHORIZED" } } });
  });

  it("returns 403 ACCESS_REVOKED for a revoked membership", async () => {
    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => ({ outcome: "ACCESS_REVOKED" }),
    });

    expect(result).toEqual({ status: 403, body: { error: { code: "ACCESS_REVOKED" } } });
  });

  it("returns 200 with course and membership context for an authorized member", async () => {
    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => ({
        outcome: "READY",
        course: { id: VALID_UUID, title: "Intro to Economics" },
        membership: {
          id: "m1",
          userId: "user-1",
          courseId: VALID_UUID,
          role: "LEARNER",
          joinedAt: new Date("2026-01-01T00:00:00Z"),
          revokedAt: null,
          archivedAt: null,
        },
      }),
    });

    expect(result).toEqual({
      status: 200,
      body: {
        course: { id: VALID_UUID, title: "Intro to Economics" },
        membership: { role: "LEARNER", joinedAt: "2026-01-01T00:00:00.000Z" },
      },
    });
  });

  it("never returns grading-only or admin-only fields", async () => {
    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => ({
        outcome: "READY",
        course: { id: VALID_UUID, title: "Intro to Economics" },
        membership: {
          id: "m1",
          userId: "user-1",
          courseId: VALID_UUID,
          role: "OWNER",
          joinedAt: new Date("2026-01-01T00:00:00Z"),
          revokedAt: null,
          archivedAt: null,
        },
      }),
    });

    expect(JSON.stringify(result)).not.toContain("owner_user_id");
    expect(JSON.stringify(result)).not.toContain("join_policy");
  });

  it("returns 500 INTERNAL_ERROR without leaking details when getContext throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleGetCourseContext({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      courseId: VALID_UUID,
      getContext: async () => {
        throw new Error("boom: postgres://secret");
      },
    });

    expect(result).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(result)).not.toContain("secret");

    consoleErrorSpy.mockRestore();
  });
});
