/**
 * Regression coverage for the same auth-before-DB ordering property the
 * DailyPlan answer/skip routes' own `route-auth-db-ordering.test.ts` files
 * protect, applied to `POST /api/courses/:courseId/join`.
 *
 * Mocks ONLY the infrastructure/application modules `route.ts` itself
 * imports, then imports and calls the REAL `POST` export from `../route`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  joinCourse: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/infrastructure/supabase/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/infrastructure/postgres/pg-pool", () => ({
  getPool: mocks.getPool,
}));

vi.mock("@/infrastructure/postgres/course-membership-repository", () => ({
  PostgresCourseMembershipRepository: mocks.PostgresCourseMembershipRepository,
}));

vi.mock("@/infrastructure/postgres/course-repository", () => ({
  PostgresCourseRepository: mocks.PostgresCourseRepository,
}));

vi.mock("@/application/course/join-course", () => ({
  joinCourse: mocks.joinCourse,
}));

// `vi.mock` calls above are hoisted above this import by Vitest, so `POST`
// here is the real production route, wired against the mocks above.
import { POST } from "../route";

function makeRequest(): Request {
  return new Request("http://localhost/api/courses/course-1/join", { method: "POST" });
}

function makeParams(courseId: string): { params: Promise<{ courseId: string }> } {
  return { params: Promise.resolve({ courseId }) };
}

describe("POST /api/courses/:courseId/join — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("A. unauthenticated: 401, getPool/repository construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(makeRequest(), makeParams("course-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.PostgresCourseMembershipRepository).not.toHaveBeenCalled();
    expect(mocks.PostgresCourseRepository).not.toHaveBeenCalled();
    expect(mocks.joinCourse).not.toHaveBeenCalled();
  });

  it("B. authenticated: real DB construction wiring is reached, exactly once, with the URL courseId and authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.joinCourse.mockResolvedValue({
      outcome: "JOINED",
      membership: { role: "LEARNER" },
    });

    const response = await POST(makeRequest(), makeParams("course-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "JOINED", role: "LEARNER" });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresCourseMembershipRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.PostgresCourseRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.joinCourse).toHaveBeenCalledTimes(1);

    const [command] = mocks.joinCourse.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe("course-1");
  });

  it("C. authenticated but DB construction throws: 500 INTERNAL_ERROR, no raw error/secret leaked", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    mocks.getPool.mockImplementation(() => {
      throw new Error(
        "getPool(): DATABASE_URL is not set. postgres://secret-user:hunter2@host/db",
      );
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(), makeParams("course-1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("hunter2");

    consoleErrorSpy.mockRestore();
  });

  it("D. route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error("createSupabaseServerClient(): missing env vars."),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(), makeParams("course-1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
