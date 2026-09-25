/**
 * Auth-before-DB ordering regression for
 * `GET /api/courses/:courseId/topic-insights`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  PostgresItemAnalysisRepository: vi.fn(),
  getCourseTopicInsights: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/infrastructure/postgres/pg-pool", () => ({ getPool: mocks.getPool }));
vi.mock("@/infrastructure/postgres/course-membership-repository", () => ({
  PostgresCourseMembershipRepository: mocks.PostgresCourseMembershipRepository,
}));
vi.mock("@/infrastructure/postgres/course-repository", () => ({
  PostgresCourseRepository: mocks.PostgresCourseRepository,
}));
vi.mock("@/infrastructure/postgres/item-analysis-repository", () => ({
  PostgresItemAnalysisRepository: mocks.PostgresItemAnalysisRepository,
}));
vi.mock("@/application/insights/get-course-topic-insights", () => ({
  getCourseTopicInsights: mocks.getCourseTopicInsights,
}));

import { GET } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const params = { params: Promise.resolve({ courseId: COURSE_ID }) };

describe("GET /api/courses/:courseId/topic-insights — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool and repositories never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(new Request("http://localhost/api/courses/x/topic-insights"), params);

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresItemAnalysisRepository).not.toHaveBeenCalled();
    expect(mocks.getCourseTopicInsights).not.toHaveBeenCalled();
  });

  it("authenticated: reaches DB wiring with the session user only; response is no-store", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u-1" });
    const fakePool = { marker: "pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.getCourseTopicInsights.mockResolvedValue({ outcome: "NOT_AUTHORIZED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/topic-insights?userId=attacker"),
      params,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresItemAnalysisRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.getCourseTopicInsights.mock.calls[0][0]).toMatchObject({
      actorUserId: "u-1",
      courseId: COURSE_ID,
    });
  });
});
