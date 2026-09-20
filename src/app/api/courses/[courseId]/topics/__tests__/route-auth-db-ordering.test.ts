/**
 * Auth-before-DB ordering regression for
 * `GET/POST /api/courses/:courseId/topics`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  listTopicsForCourse: vi.fn(),
  createTopic: vi.fn(),
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
vi.mock("@/infrastructure/postgres/topic-repository", () => ({
  PostgresTopicRepository: mocks.PostgresTopicRepository,
}));
vi.mock("@/application/topic/list-topics-for-course", () => ({
  listTopicsForCourse: mocks.listTopicsForCourse,
}));
vi.mock("@/application/topic/create-topic", () => ({ createTopic: mocks.createTopic }));

import { GET, POST } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

describe("GET/POST /api/courses/:courseId/topics — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("GET unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/topics"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.listTopicsForCourse).not.toHaveBeenCalled();
  });

  it("GET authenticated: reaches real DB construction wiring", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.listTopicsForCourse.mockResolvedValue({ outcome: "READY", topics: [] });

    const response = await GET(
      new Request("http://localhost/api/courses/x/topics"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresTopicRepository).toHaveBeenCalledWith(fakePool);
  });

  it("POST unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      new Request("http://localhost/api/courses/x/topics", {
        method: "POST",
        body: JSON.stringify({ name: "Algebra" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.createTopic).not.toHaveBeenCalled();
  });

  it("POST authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.createTopic.mockResolvedValue({
      outcome: "CREATED",
      topic: {
        id: "topic-1",
        courseId: COURSE_ID,
        name: "Algebra",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/courses/x/topics", {
        method: "POST",
        body: JSON.stringify({ name: "Algebra" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(201);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.createTopic.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
  });
});
