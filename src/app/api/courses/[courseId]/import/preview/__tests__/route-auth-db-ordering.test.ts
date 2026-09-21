/**
 * Auth-before-DB ordering regression for `POST /api/courses/:courseId/import/preview`.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  getPool: vi.fn(),
  PostgresCourseMembershipRepository: vi.fn(),
  PostgresCourseRepository: vi.fn(),
  PostgresTopicRepository: vi.fn(),
  previewImport: vi.fn(),
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
vi.mock("@/infrastructure/postgres/topic-repository", () => ({
  PostgresTopicRepository: mocks.PostgresTopicRepository,
}));
vi.mock("@/application/import/preview-import", () => ({
  previewImport: mocks.previewImport,
}));

import { POST } from "../route";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeParams(courseId: string) {
  return { params: Promise.resolve({ courseId }) };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/courses/x/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/courses/:courseId/import/preview — real route wiring: auth before DB construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
  });

  it("unauthenticated: 401, getPool never reached", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ outcome: "UNAUTHENTICATED" });

    const response = await POST(
      makeRequest({ format: "JSON", sourceText: "[]" }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(401);
    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.previewImport).not.toHaveBeenCalled();
  });

  it("authenticated: reaches real DB construction wiring with the authenticated userId", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      outcome: "AUTHENTICATED",
      userId: "supabase-user-1",
    });
    const fakePool = { marker: "fake-pool" };
    mocks.getPool.mockReturnValue(fakePool);
    mocks.previewImport.mockResolvedValue({
      outcome: "PREVIEWED",
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      rows: [],
    });

    const response = await POST(
      makeRequest({ format: "JSON", sourceText: "[]" }),
      makeParams(COURSE_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPool).toHaveBeenCalledTimes(1);
    expect(mocks.PostgresCourseRepository).toHaveBeenCalledWith(fakePool);
    expect(mocks.PostgresTopicRepository).toHaveBeenCalledWith(fakePool);
    const [command] = mocks.previewImport.mock.calls[0];
    expect(command.actorUserId).toBe("supabase-user-1");
    expect(command.courseId).toBe(COURSE_ID);
  });
});
