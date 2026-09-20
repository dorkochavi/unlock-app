/**
 * Auth-before-DB ordering regression for `POST /api/courses`, mirroring
 * `courses/[courseId]/join/__tests__/route-auth-db-ordering.test.ts`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PgConnectionProvider: vi.fn(),
  PostgresCourseUnitOfWork: vi.fn(),
  createCourse: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/infrastructure/postgres/pg-pool", () => ({ getPool: mocks.getPool }));
vi.mock("@/infrastructure/postgres/pg-connection-provider", () => ({
  PgConnectionProvider: mocks.PgConnectionProvider,
}));
vi.mock("@/infrastructure/postgres/postgres-course-unit-of-work", () => ({
  PostgresCourseUnitOfWork: mocks.PostgresCourseUnitOfWork,
}));
vi.mock("@/application/course/create-course", () => ({ createCourse: mocks.createCourse }));

import { POST } from "../route";

function makeRequest(body: unknown = { title: "Intro" }): Request {
  return new Request("http://localhost/api/courses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/courses — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool/repository construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.createCourse).not.toHaveBeenCalled();
  });

  it("authenticated: real DB construction wiring is reached with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.createCourse.mockResolvedValue({
      outcome: "CREATED",
      course: {
        id: "course-1",
        title: "Intro",
        status: "DRAFT",
        joinPolicy: "AUTHORIZED_ONLY",
        examDate: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.course.id).toBe("course-1");
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PgConnectionProvider).toHaveBeenCalledWith(fakePool);
    expect(mocks.PostgresCourseUnitOfWork).toHaveBeenCalledTimes(1);

    const [command] = mocks.createCourse.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
  });

  it("authenticated but DB construction throws: 500 INTERNAL_ERROR, no raw error/secret leaked", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    mocks.getPool.mockImplementation(() => {
      throw new Error("getPool(): DATABASE_URL is not set. postgres://secret:hunter2@host/db");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");

    consoleErrorSpy.mockRestore();
  });
});
