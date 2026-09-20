/**
 * Unit tests for `handleJoinCourse` — the testable core of
 * `POST /api/courses/:courseId/join`. Every dependency is faked; no real
 * Supabase/network/Postgres connection anywhere in this file. The
 * underlying `joinCourse` use case's own policy logic (OPEN vs
 * AUTHORIZED_ONLY, idempotency, revoked-rejoin) is already covered by
 * `src/application/course/__tests__/join-course.test.ts` — this file only
 * proves the ROUTE-layer mapping/trust-boundary behavior.
 */
import { describe, expect, it, vi } from "vitest";

import type { JoinCourseResult } from "../../../../../../application/course/join-course";
import type { RequireAuthenticatedUserResult } from "../../../../../../infrastructure/supabase/require-authenticated-user";
import { handleJoinCourse } from "../handle-join-course";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

function membership(overrides: Partial<{ role: "OWNER" | "INSTRUCTOR" | "LEARNER"; revokedAt: Date | null }> = {}) {
  return {
    id: "membership-1",
    userId: "supabase-user-1",
    courseId: "123e4567-e89b-12d3-a456-426614174000",
    role: overrides.role ?? "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: overrides.revokedAt ?? null,
    archivedAt: null,
  };
}

describe("handleJoinCourse", () => {
  it("unauthenticated: 401, never calls join", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const join = vi.fn();

    const response = await handleJoinCourse({ authenticate, courseId: "123e4567-e89b-12d3-a456-426614174000", join });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(join).not.toHaveBeenCalled();
  });

  it("malformed/non-UUID courseId: 404 COURSE_NOT_FOUND, join never called (no raw Postgres UUID-parse failure)", async () => {
    const join = vi.fn();

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      join,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "COURSE_NOT_FOUND" } });
    expect(join).not.toHaveBeenCalled();
  });

  it("unauthenticated AND malformed courseId: 401 UNAUTHENTICATED, never 404 — auth ordering pinned regardless of courseId validity", async () => {
    const authenticate = vi.fn(
      async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "UNAUTHENTICATED" }),
    );
    const join = vi.fn();

    const response = await handleJoinCourse({ authenticate, courseId: "not-a-uuid", join });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(join).not.toHaveBeenCalled();
  });

  it("never accepts/consumes a client-supplied userId — the ONLY actorUserId reaching join is authResult.userId", async () => {
    const join = vi.fn(
      async (): Promise<JoinCourseResult> => ({ outcome: "JOINED", membership: membership() }),
    );

    await handleJoinCourse({
      authenticate: authenticated("the-real-authenticated-user"),
      courseId: "123e4567-e89b-12d3-a456-426614174001",
      join,
    });

    expect(join).toHaveBeenCalledWith({
      actorUserId: "the-real-authenticated-user",
      courseId: "123e4567-e89b-12d3-a456-426614174001",
    });
  });

  it("COURSE_NOT_FOUND: 404", async () => {
    const join = vi.fn(async (): Promise<JoinCourseResult> => ({ outcome: "COURSE_NOT_FOUND" }));

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "COURSE_NOT_FOUND" } });
  });

  it("NOT_AUTHORIZED (AUTHORIZED_ONLY course): 403 NOT_AUTHORIZED", async () => {
    const join = vi.fn(async (): Promise<JoinCourseResult> => ({ outcome: "NOT_AUTHORIZED" }));

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: "NOT_AUTHORIZED" } });
  });

  it("JOINED: 200 with status JOINED and the real role", async () => {
    const join = vi.fn(
      async (): Promise<JoinCourseResult> => ({ outcome: "JOINED", membership: membership() }),
    );

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "JOINED", role: "LEARNER" });
  });

  it("ALREADY_MEMBER with an active membership: 200 idempotent success", async () => {
    const join = vi.fn(
      async (): Promise<JoinCourseResult> => ({
        outcome: "ALREADY_MEMBER",
        membership: membership({ revokedAt: null }),
      }),
    );

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ALREADY_MEMBER", role: "LEARNER" });
  });

  it("ALREADY_MEMBER with a pre-existing OWNER membership: 200, role preserved as OWNER — never downgraded", async () => {
    const join = vi.fn(
      async (): Promise<JoinCourseResult> => ({
        outcome: "ALREADY_MEMBER",
        membership: membership({ role: "OWNER", revokedAt: null }),
      }),
    );

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ALREADY_MEMBER", role: "OWNER" });
  });

  it("ALREADY_MEMBER with a REVOKED membership: 403 ACCESS_REVOKED — never a false success (fail closed, no rejoin policy invented)", async () => {
    const join = vi.fn(
      async (): Promise<JoinCourseResult> => ({
        outcome: "ALREADY_MEMBER",
        membership: membership({ revokedAt: new Date("2026-01-05T00:00:00.000Z") }),
      }),
    );

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: "ACCESS_REVOKED" } });
  });

  it("unexpected thrown error from join: stable 500, no raw error/database details leaked", async () => {
    const join = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host:5432/db failed: ECONNREFUSED");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleJoinCourse({
      authenticate: authenticated(),
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      join,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response.body)).not.toContain("postgres://");

    consoleErrorSpy.mockRestore();
  });

  it("unexpected thrown error from authenticate itself: also mapped to a stable 500, join never called", async () => {
    const authenticate = vi.fn(async () => {
      throw new Error("unexpected Supabase SDK failure");
    });
    const join = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleJoinCourse({ authenticate, courseId: "123e4567-e89b-12d3-a456-426614174000", join });

    expect(response.status).toBe(500);
    expect(join).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
