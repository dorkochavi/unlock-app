import { describe, expect, it, vi } from "vitest";

import { handleGetMyCourses } from "../handle-get-my-courses";

describe("handleGetMyCourses", () => {
  it("returns 401 when unauthenticated, without calling listCourses", async () => {
    const listCourses = vi.fn();

    const result = await handleGetMyCourses({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      listCourses,
    });

    expect(result).toEqual({ status: 401, body: { error: { code: "UNAUTHENTICATED" } } });
    expect(listCourses).not.toHaveBeenCalled();
  });

  it("returns an empty course list for a learner with no active memberships", async () => {
    const result = await handleGetMyCourses({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      listCourses: async () => [],
    });

    expect(result).toEqual({ status: 200, body: { courses: [] } });
  });

  it("maps courses using the authenticated user's own id, never a client-supplied one", async () => {
    const listCourses = vi.fn().mockResolvedValue([
      { courseId: "course-1", title: "Intro to Economics", role: "LEARNER" },
    ]);

    const result = await handleGetMyCourses({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      listCourses,
    });

    expect(listCourses).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({
      status: 200,
      body: { courses: [{ id: "course-1", title: "Intro to Economics", role: "LEARNER" }] },
    });
  });

  it("returns 500 INTERNAL_ERROR without leaking details when authentication throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleGetMyCourses({
      authenticate: async () => {
        throw new Error("boom: DATABASE_URL=postgres://secret");
      },
      listCourses: vi.fn(),
    });

    expect(result).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(result)).not.toContain("secret");

    consoleErrorSpy.mockRestore();
  });

  it("returns 500 INTERNAL_ERROR without leaking details when listCourses throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handleGetMyCourses({
      authenticate: async () => ({ outcome: "AUTHENTICATED", userId: "user-1" }),
      listCourses: async () => {
        throw new Error("boom: connection string leaked");
      },
    });

    expect(result).toEqual({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(JSON.stringify(result)).not.toContain("connection string");

    consoleErrorSpy.mockRestore();
  });
});
