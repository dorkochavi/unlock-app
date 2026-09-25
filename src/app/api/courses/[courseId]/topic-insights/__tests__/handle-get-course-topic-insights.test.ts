import { describe, expect, it, vi } from "vitest";

import { handleGetCourseTopicInsights } from "../handle-get-course-topic-insights";

import type { GetCourseTopicInsightsResult } from "@/application/insights/get-course-topic-insights";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-25T09:00:00Z");
const authenticated = () =>
  vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId: "user-1" }));

describe("handleGetCourseTopicInsights", () => {
  it("unauthenticated: 401, use case never called", async () => {
    const getTopicInsights = vi.fn();
    const response = await handleGetCourseTopicInsights({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights,
    });
    expect(response.status).toBe(401);
    expect(getTopicInsights).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, use case never called", async () => {
    const getTopicInsights = vi.fn();
    const response = await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: "nope",
      now: () => NOW,
      getTopicInsights,
    });
    expect(response.status).toBe(404);
    expect(getTopicInsights).not.toHaveBeenCalled();
  });

  it("passes the authenticated user id and injected clock only", async () => {
    const getTopicInsights = vi.fn(
      async (): Promise<GetCourseTopicInsightsResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights,
    });
    expect(getTopicInsights).toHaveBeenCalledWith({ actorUserId: "user-1", courseId: COURSE_ID, now: NOW });
  });

  it.each([
    [{ outcome: "NOT_AUTHORIZED" }, 403, "NOT_AUTHORIZED"],
    [{ outcome: "COURSE_NOT_ACTIVE" }, 409, "COURSE_NOT_ACTIVE"],
  ] as const)("%j -> %s", async (result, status, code) => {
    const response = await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights: async () => result as GetCourseTopicInsightsResult,
    });
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: { code } });
  });

  it("READY: 200 with ISO generatedAt and only whitelisted band fields", async () => {
    const response = await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights: async () => ({
        outcome: "READY",
        generatedAt: NOW,
        topics: [
          { topicId: "t-1", name: "Algebra", archived: false, disclosure: "ELIGIBLE", band: "MIXED" },
          { topicId: null, name: null, archived: false, disclosure: "INSUFFICIENT_DATA", band: null },
        ],
      }),
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      generatedAt: "2026-09-25T09:00:00.000Z",
      topics: [
        { topicId: "t-1", name: "Algebra", archived: false, disclosure: "ELIGIBLE", band: "MIXED" },
        { topicId: null, name: null, archived: false, disclosure: "INSUFFICIENT_DATA", band: null },
      ],
    });
  });

  it("drops any extra field a use-case result might carry (whitelist mapping)", async () => {
    const leaky = {
      topicId: "t-1",
      name: "Algebra",
      archived: false,
      disclosure: "ELIGIBLE",
      band: "MIXED",
      distinctResponderCount: 22,
      approximatePercent: 40,
    };
    const response = await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights: async () =>
        ({ outcome: "READY", generatedAt: NOW, topics: [leaky] }) as unknown as GetCourseTopicInsightsResult,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/22|approximatePercent|distinctResponderCount/);
  });

  it("unexpected error: 500 INTERNAL_ERROR with no leaked detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleGetCourseTopicInsights({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getTopicInsights: async () => {
        throw new Error("select * from attempts failed: secret-connection-detail");
      },
    });
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/secret|select/);
  });
});
