/**
 * Auth-before-DB ordering regression for
 * `POST /api/courses/:courseId/topics/:topicId/archive`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  archiveTopic: vi.fn(),
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
vi.mock("@/application/topic/archive-topic", () => ({ archiveTopic: mocks.archiveTopic }));

import { POST } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC_ID = "223e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string, topicId: string) {
  return { params: Promise.resolve({ courseId, topicId }) };
}

describe("POST /api/courses/:courseId/topics/:topicId/archive — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      new Request("http://localhost/api/courses/x/topics/y/archive", { method: "POST" }),
      makeParams(COURSE_ID, TOPIC_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.archiveTopic).not.toHaveBeenCalled();
  });

  it("authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.archiveTopic.mockResolvedValue({
      outcome: "ARCHIVED",
      topic: {
        id: TOPIC_ID,
        courseId: COURSE_ID,
        name: "Algebra",
        archivedAt: new Date("2026-01-03T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/courses/x/topics/y/archive", { method: "POST" }),
      makeParams(COURSE_ID, TOPIC_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.archiveTopic.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
    expect(command.topicId).toBe(TOPIC_ID);
  });
});
