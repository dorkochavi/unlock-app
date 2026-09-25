/**
 * Auth-before-DB ordering regression for
 * `GET /api/courses/:courseId/topic-progress`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  PostgresLearnerTopicProgressRepository: vi.fn(),
  getCourseTopicProgress: vi.fn(),
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
vi.mock("@/infrastructure/postgres/topic-progress-repository", () => ({
  PostgresLearnerTopicProgressRepository: mocks.PostgresLearnerTopicProgressRepository,
}));
vi.mock("@/application/progress/get-course-topic-progress", () => ({
  getCourseTopicProgress: mocks.getCourseTopicProgress,
}));

import { GET } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const params = { params: Promise.resolve({ courseId: COURSE_ID }) };

describe("GET /api/courses/:courseId/topic-progress — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool and repositories never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/topic-progress"),
      params,
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresLearnerTopicProgressRepository).not.toHaveBeenCalled();
    expect(mocks.getCourseTopicProgress).not.toHaveBeenCalled();
  });

  it("authenticated: reaches DB wiring with the session user only; response is no-store", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "AUTHENTICATED", userId: "u-1" });
    const fakePool = { marker: "pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.getCourseTopicProgress.mockResolvedValue({ outcome: "NOT_AUTHORIZED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/topic-progress?userId=attacker"),
      params,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.PostgresLearnerTopicProgressRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.getCourseTopicProgress.mock.calls[0][0]).toEqual({
      actorUserId: "u-1",
      courseId: COURSE_ID,
    });
  });
});
