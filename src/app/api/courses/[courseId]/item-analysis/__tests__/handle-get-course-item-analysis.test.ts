import { describe, expect, it, vi } from "vitest";

import { handleGetCourseItemAnalysis } from "../handle-get-course-item-analysis";

import type { GetCourseItemAnalysisResult } from "@/application/insights/get-course-item-analysis";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-24T09:00:00Z");

const authenticated = () => vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId: "user-1" }));

describe("handleGetCourseItemAnalysis", () => {
  it("unauthenticated: 401, use case never called", async () => {
    const getItemAnalysis = vi.fn();
    const response = await handleGetCourseItemAnalysis({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      now: () => NOW,
      getItemAnalysis,
    });
    expect(response.status).toBe(401);
    expect(getItemAnalysis).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404, use case never called", async () => {
    const getItemAnalysis = vi.fn();
    const response = await handleGetCourseItemAnalysis({
      authenticate: authenticated(),
      courseId: "nope",
      now: () => NOW,
      getItemAnalysis,
    });
    expect(response.status).toBe(404);
    expect(getItemAnalysis).not.toHaveBeenCalled();
  });

  it("passes the authenticated user id and injected clock, never a request-supplied identity", async () => {
    const getItemAnalysis = vi.fn(
      async (): Promise<GetCourseItemAnalysisResult> => ({ outcome: "NOT_AUTHORIZED" }),
    );
    await handleGetCourseItemAnalysis({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getItemAnalysis,
    });
    expect(getItemAnalysis).toHaveBeenCalledWith({ actorUserId: "user-1", courseId: COURSE_ID, now: NOW });
  });

  it.each([
    [{ outcome: "NOT_AUTHORIZED" }, 403, "NOT_AUTHORIZED"],
    [{ outcome: "COURSE_NOT_ACTIVE" }, 409, "COURSE_NOT_ACTIVE"],
  ] as const)("%j -> %s", async (result, status, code) => {
    const response = await handleGetCourseItemAnalysis({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getItemAnalysis: async () => result as GetCourseItemAnalysisResult,
    });
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: { code } });
  });

  it("READY: 200 with ISO generatedAt and aggregate-only items", async () => {
    const response = await handleGetCourseItemAnalysis({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getItemAnalysis: async () => ({
        outcome: "READY",
        generatedAt: NOW,
        items: [
          {
            questionId: "q-1",
            questionVersionId: "qv-1",
            prompt: "P",
            disclosure: "INSUFFICIENT_RESPONSES",
            stats: null,
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      generatedAt: "2026-09-24T09:00:00.000Z",
      items: [
        {
          questionId: "q-1",
          questionVersionId: "qv-1",
          prompt: "P",
          disclosure: "INSUFFICIENT_RESPONSES",
          stats: null,
        },
      ],
    });
  });

  it("unexpected error: 500 INTERNAL_ERROR with no leaked detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleGetCourseItemAnalysis({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      now: () => NOW,
      getItemAnalysis: async () => {
        throw new Error("select * from attempts failed: secret-connection-detail");
      },
    });
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/secret|select/);
  });
});
