import { describe, expect, it, vi } from "vitest";

import { handleSetCourseJoinPolicy } from "../handle-set-course-join-policy";

import type { SetCourseJoinPolicyResult } from "@/application/course/set-course-join-policy";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleSetCourseJoinPolicy", () => {
  it("unauthenticated: 401, never calls setJoinPolicy", async () => {
    const setJoinPolicy = vi.fn();
    const response = await handleSetCourseJoinPolicy({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      body: { joinPolicy: "OPEN" },
      setJoinPolicy,
    });

    expect(response.status).toBe(401);
    expect(setJoinPolicy).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, setJoinPolicy never called", async () => {
    const setJoinPolicy = vi.fn();
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      body: { joinPolicy: "OPEN" },
      setJoinPolicy,
    });

    expect(response.status).toBe(404);
    expect(setJoinPolicy).not.toHaveBeenCalled();
  });

  it("missing joinPolicy: 400 INVALID_REQUEST", async () => {
    const setJoinPolicy = vi.fn();
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: {},
      setJoinPolicy,
    });

    expect(response.status).toBe(400);
    expect(setJoinPolicy).not.toHaveBeenCalled();
  });

  it("invalid joinPolicy value: 400 INVALID_REQUEST", async () => {
    const setJoinPolicy = vi.fn();
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { joinPolicy: "SOMETHING_ELSE" },
      setJoinPolicy,
    });

    expect(response.status).toBe(400);
    expect(setJoinPolicy).not.toHaveBeenCalled();
  });

  it("malformed body: 400 INVALID_REQUEST", async () => {
    const setJoinPolicy = vi.fn();
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: null,
      setJoinPolicy,
    });

    expect(response.status).toBe(400);
    expect(setJoinPolicy).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const setJoinPolicy = vi.fn(
      async (): Promise<SetCourseJoinPolicyResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { joinPolicy: "OPEN" },
      setJoinPolicy,
    });

    expect(response.status).toBe(403);
  });

  it("COURSE_NOT_FOUND: 404", async () => {
    const setJoinPolicy = vi.fn(
      async (): Promise<SetCourseJoinPolicyResult> => ({ outcome: "COURSE_NOT_FOUND" }),
    );
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { joinPolicy: "OPEN" },
      setJoinPolicy,
    });

    expect(response.status).toBe(404);
  });

  it("UPDATED: 200 with the new joinPolicy, passing actor/courseId/joinPolicy through", async () => {
    const setJoinPolicy = vi.fn(
      async (): Promise<SetCourseJoinPolicyResult> => ({ outcome: "UPDATED", joinPolicy: "OPEN" }),
    );
    const response = await handleSetCourseJoinPolicy({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { joinPolicy: "OPEN" },
      setJoinPolicy,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ joinPolicy: "OPEN" });
    expect(setJoinPolicy).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      joinPolicy: "OPEN",
    });
  });
});
