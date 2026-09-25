import { describe, expect, it, vi } from "vitest";

import { handleGetCourseTopicProgress } from "../handle-get-course-topic-progress";

import type { GetCourseTopicProgressResult } from "@/application/progress/get-course-topic-progress";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const authenticated = () =>
  vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId: "user-1" }));

describe("handleGetCourseTopicProgress", () => {
  it("unauthenticated: 401, use case never called", async () => {
    const getTopicProgress = vi.fn();
    const response = await handleGetCourseTopicProgress({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      getTopicProgress,
    });
    expect(response).toEqual({ status: 401, body: { error: { code: "UNAUTHENTICATED" } } });
    expect(getTopicProgress).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, use case never called", async () => {
    const getTopicProgress = vi.fn();
    const response = await handleGetCourseTopicProgress({
      authenticate: authenticated(),
      courseId: "nope",
      getTopicProgress,
    });
    expect(response.status).toBe(404);
    expect(getTopicProgress).not.toHaveBeenCalled();
  });

  it("passes only the authenticated user id and Course id", async () => {
    const getTopicProgress = vi.fn(
      async (): Promise<GetCourseTopicProgressResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    await handleGetCourseTopicProgress({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getTopicProgress,
    });
    expect(getTopicProgress).toHaveBeenCalledWith({ actorUserId: "user-1", courseId: COURSE_ID });
  });

  it.each<[GetCourseTopicProgressResult, number, unknown]>([
    [{ outcome: "NOT_AUTHORIZED" }, 403, { error: { code: "NOT_AUTHORIZED" } }],
    [{ outcome: "COURSE_NOT_ACTIVE" }, 409, { error: { code: "COURSE_NOT_ACTIVE" } }],
  ])("maps %j to %i", async (result, status, body) => {
    const response = await handleGetCourseTopicProgress({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getTopicProgress: async () => result,
    });
    expect(response).toEqual({ status, body });
  });

  it("READY -> 200 with only the whitelisted topic fields", async () => {
    const response = await handleGetCourseTopicProgress({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getTopicProgress: async () => ({
        outcome: "READY",
        topics: [{ topicId: "t-1", name: "Alpha", state: "SOLID", attemptedCount: 3, totalCount: 4 }],
      }),
    });
    expect(response).toEqual({
      status: 200,
      body: {
        topics: [
          { topicId: "t-1", name: "Alpha", state: "SOLID", attemptedCount: 3, totalCount: 4 },
        ],
      },
    });
  });

  it("unexpected error: 500 INTERNAL_ERROR with no leakage", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleGetCourseTopicProgress({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      getTopicProgress: async () => {
        throw new Error("select * from secret_table connection refused");
      },
    });
    spy.mockRestore();
    expect(response).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(response)).not.toContain("secret_table");
  });

  it("authentication failure: 500 INTERNAL_ERROR, use case never called", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const getTopicProgress = vi.fn();
    const response = await handleGetCourseTopicProgress({
      authenticate: async () => {
        throw new Error("boom");
      },
      courseId: COURSE_ID,
      getTopicProgress,
    });
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(getTopicProgress).not.toHaveBeenCalled();
  });
});
