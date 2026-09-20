/**
 * Real route-wiring test for `GET /api/courses/:courseId/context`, mirroring
 * `courses/:courseId/join/__tests__/route-auth-db-ordering.test.ts`: mocks
 * only the infrastructure modules `route.ts` itself imports, then imports
 * and calls the REAL `GET` export — proving `getPool()`/repository
 * construction is unreachable for an unauthenticated request.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  getCourseContextForLearner: vi.fn(),
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
  PostgresCourseMembershipRepository: vi.fn(),
}));

vi.mock("@/infrastructure/postgres/course-repository", () => ({
  PostgresCourseRepository: vi.fn(),
}));

vi.mock("@/application/course/get-course-context-for-learner", () => ({
  getCourseContextForLearner: mocks.getCourseContextForLearner,
}));

import { GET } from "../route";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

describe("GET /api/courses/:courseId/context — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool/DB construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await GET(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.getCourseContextForLearner).not.toHaveBeenCalled();
  });

  it("authenticated with malformed courseId: 404, getPool/DB construction never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });

    const response = await GET(new Request("http://localhost"), makeParams("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: { code: "COURSE_NOT_FOUND" } });
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.getCourseContextForLearner).not.toHaveBeenCalled();
  });

  it("authenticated with well-formed courseId: real DB construction wiring is reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.getCourseContextForLearner.mockResolvedValue({ outcome: "COURSE_NOT_FOUND" });

    const response = await GET(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: { code: "COURSE_NOT_FOUND" } });
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.getCourseContextForLearner).toHaveBeenCalledWith(
      { actorUserId: "supabase-user-1", courseId: VALID_UUID },
      expect.any(Object),
    );
  });

  it("route-level infrastructure failure before authentication even runs: 500 INTERNAL_ERROR, no leak", async () => {
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error("createSupabaseServerClient(): missing env vars"),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new Request("http://localhost"), makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
