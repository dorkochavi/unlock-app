/**
 * Auth-before-DB ordering regression for
 * `PATCH /api/courses/:courseId/topics/:topicId`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  renameTopic: vi.fn(),
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
vi.mock("@/application/topic/rename-topic", () => ({ renameTopic: mocks.renameTopic }));

import { PATCH } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";
const TOPIC_ID = "223e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string, topicId: string) {
  return { params: Promise.resolve({ courseId, topicId }) };
}

describe("PATCH /api/courses/:courseId/topics/:topicId — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/topics/y", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      makeParams(COURSE_ID, TOPIC_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.renameTopic).not.toHaveBeenCalled();
  });

  it("authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.renameTopic.mockResolvedValue({
      outcome: "RENAMED",
      topic: {
        id: TOPIC_ID,
        courseId: COURSE_ID,
        name: "Renamed",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/topics/y", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      makeParams(COURSE_ID, TOPIC_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.renameTopic.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
    expect(command.topicId).toBe(TOPIC_ID);
  });
});

describe("PATCH /api/courses/:courseId/topics/:topicId — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = new Request("http://localhost/api/courses/x/topics/y", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    });
    const jsonSpy = vi.spyOn(request, "json");

    await PATCH(request, makeParams(COURSE_ID, TOPIC_ID));

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("authenticates before calling request.json() for an authenticated request", async () => {
    const callOrder: string[] = [];
    mocks.requireAuthenticatedUser.mockImplementation(async () => {
      callOrder.push("authenticate");
      return { outcome: "AUTHENTICATED", userId: "supabase-user-1" };
    });
    mocks.renameTopic.mockResolvedValue({
      outcome: "RENAMED",
      topic: {
        id: TOPIC_ID,
        courseId: COURSE_ID,
        name: "Renamed",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const request = new Request("http://localhost/api/courses/x/topics/y", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, "json").mockImplementation(async () => {
      callOrder.push("parse");
      return originalJson();
    });

    await PATCH(request, makeParams(COURSE_ID, TOPIC_ID));

    expect(callOrder).toEqual(["authenticate", "parse"]);
  });
});
