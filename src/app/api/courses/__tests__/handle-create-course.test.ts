import { describe, expect, it, vi } from "vitest";

import { handleCreateCourse } from "../handle-create-course";

import type { CreateCourseResult } from "@/application/course/create-course";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(
    async (): Promise<RequireAuthenticatedUserResult> => ({ outcome: "AUTHENTICATED", userId }),
  );
}

describe("handleCreateCourse", () => {
  it("unauthenticated: 401, never calls create", async () => {
    const create = vi.fn();
    const response = await handleCreateCourse({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      body: { title: "Intro" },
      create,
    });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("missing title: 400 INVALID_REQUEST, create never called", async () => {
    const create = vi.fn();
    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: {},
      create,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("malformed examDate: 400 INVALID_REQUEST", async () => {
    const create = vi.fn();
    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: { title: "Intro", examDate: "not-a-date" },
      create,
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("shape-valid but calendar-impossible examDate (2026-99-99): 400 INVALID_REQUEST, never reaches create", async () => {
    const create = vi.fn();
    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: { title: "Intro", examDate: "2026-99-99" },
      create,
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("never accepts a client-supplied actorUserId — only the authenticated userId reaches create", async () => {
    const create = vi.fn(
      async (): Promise<CreateCourseResult> => ({
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
      }),
    );

    await handleCreateCourse({
      authenticate: authenticated("real-user"),
      body: { title: "Intro", actorUserId: "attacker-supplied" },
      create,
    });

    expect(create).toHaveBeenCalledWith({
      actorUserId: "real-user",
      title: "Intro",
      examDate: null,
    });
  });

  it("CREATED: 201 with the DTO", async () => {
    const create = vi.fn(
      async (): Promise<CreateCourseResult> => ({
        outcome: "CREATED",
        course: {
          id: "course-1",
          title: "Intro",
          status: "DRAFT",
          joinPolicy: "AUTHORIZED_ONLY",
          examDate: "2026-12-01",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );

    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: { title: "Intro", examDate: "2026-12-01" },
      create,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      course: {
        id: "course-1",
        title: "Intro",
        status: "DRAFT",
        joinPolicy: "AUTHORIZED_ONLY",
        examDate: "2026-12-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("INVALID_TITLE: 400 INVALID_REQUEST", async () => {
    const create = vi.fn(async (): Promise<CreateCourseResult> => ({ outcome: "INVALID_TITLE" }));

    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: { title: "   " },
      create,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
  });

  it("unexpected thrown error: stable 500, no raw error leaked", async () => {
    const create = vi.fn(async () => {
      throw new Error("connection to postgres://secret-host/db failed");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleCreateCourse({
      authenticate: authenticated(),
      body: { title: "Intro" },
      create,
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("postgres://");
    consoleErrorSpy.mockRestore();
  });
});
