/**
 * Auth-before-DB ordering regression for
 * `GET/PATCH /api/courses/:courseId/manage`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  getCourseForAuthoring: vi.fn(),
  updateCourseMetadata: vi.fn(),
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
vi.mock("@/application/course/get-course-for-authoring", () => ({
  getCourseForAuthoring: mocks.getCourseForAuthoring,
}));
vi.mock("@/application/course/update-course-metadata", () => ({
  updateCourseMetadata: mocks.updateCourseMetadata,
}));

import { GET, PATCH } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

describe("GET/PATCH /api/courses/:courseId/manage — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("GET unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(
      new Request("http://localhost/api/courses/x/manage"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.getCourseForAuthoring).not.toHaveBeenCalled();
  });

  it("GET authenticated: reaches real DB construction wiring", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.getCourseForAuthoring.mockResolvedValue({
      outcome: "READY",
      course: {
        id: COURSE_ID,
        title: "Intro",
        status: "DRAFT",
        joinPolicy: "AUTHORIZED_ONLY",
        examDate: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await GET(
      new Request("http://localhost/api/courses/x/manage"),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresCourseMembershipRepository).toHaveBeenCalledWith(fakePool);
  });

  it("PATCH unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/manage", {
        method: "PATCH",
        body: JSON.stringify({ title: "New" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.updateCourseMetadata).not.toHaveBeenCalled();
  });

  it("PATCH authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.updateCourseMetadata.mockResolvedValue({
      outcome: "UPDATED",
      course: {
        id: COURSE_ID,
        title: "New",
        status: "DRAFT",
        joinPolicy: "AUTHORIZED_ONLY",
        examDate: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await PATCH(
      new Request("http://localhost/api/courses/x/manage", {
        method: "PATCH",
        body: JSON.stringify({ title: "New" }),
      }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    const [command] = mocks.updateCourseMetadata.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
  });
});

describe("PATCH /api/courses/:courseId/manage — real route wiring: auth before body parsing (Run 008 S1.E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("never calls request.json() for an unauthenticated request", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });
    const request = new Request("http://localhost/api/courses/x/manage", {
      method: "PATCH",
      body: JSON.stringify({ title: "New" }),
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
    mocks.updateCourseMetadata.mockResolvedValue({
      outcome: "UPDATED",
      course: {
        id: COURSE_ID,
        title: "New",
        status: "DRAFT",
        joinPolicy: "AUTHORIZED_ONLY",
        examDate: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const request = new Request("http://localhost/api/courses/x/manage", {
      method: "PATCH",
      body: JSON.stringify({ title: "New" }),
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
