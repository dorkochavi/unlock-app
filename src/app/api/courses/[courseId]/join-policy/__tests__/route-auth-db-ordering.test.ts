/**
 * Auth-before-DB ordering regression for
 * `PATCH /api/courses/:courseId/join-policy`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  setCourseJoinPolicy: vi.fn(),
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
vi.mock("@/application/course/set-course-join-policy", () => ({
  setCourseJoinPolicy: mocks.setCourseJoinPolicy,
}));

import { PATCH } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

describe("PATCH /api/courses/:courseId/join-policy — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/join-policy", {
        method: "PATCH",
        body: JSON.stringify({ joinPolicy: "OPEN" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.setCourseJoinPolicy).not.toHaveBeenCalled();
  });

  it("authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.setCourseJoinPolicy.mockResolvedValue({ outcome: "UPDATED", joinPolicy: "OPEN" });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/join-policy", {
        method: "PATCH",
        body: JSON.stringify({ joinPolicy: "OPEN" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.setCourseJoinPolicy.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
    expect(command.joinPolicy).toBe("OPEN");
  });
});

describe("PATCH /api/courses/:courseId/join-policy — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = new Request("http://localhost/api/courses/x/join-policy", {
      method: "PATCH",
      body: JSON.stringify({ joinPolicy: "OPEN" }),
    });
    const jsonSpy = vi.spyOn(request, "json");

    await PATCH(request, makeParams(COURSE_ID));

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("authenticates before calling request.json() for an authenticated request", async () => {
    const callOrder: string[] = [];
    mocks.requireAuthenticatedUser.mockImplementation(async () => {
      callOrder.push("authenticate");
      return { outcome: "AUTHENTICATED", userId: "supabase-user-1" };
    });
    mocks.setCourseJoinPolicy.mockResolvedValue({ outcome: "UPDATED", joinPolicy: "OPEN" });

    const request = new Request("http://localhost/api/courses/x/join-policy", {
      method: "PATCH",
      body: JSON.stringify({ joinPolicy: "OPEN" }),
    });
    const originalJson = request.json.bind(request);
    vi.spyOn(request, "json").mockImplementation(async () => {
      callOrder.push("parse");
      return originalJson();
    });

    await PATCH(request, makeParams(COURSE_ID));

    expect(callOrder).toEqual(["authenticate", "parse"]);
  });
});
