import { describe, expect, it } from "vitest";

import type { CourseMembership } from "../ports";
import { getCourseContextForLearner } from "../get-course-context-for-learner";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("getCourseContextForLearner — practiceAvailable (Run UX-02, ADR-020 §6)", () => {
  const membership = (over: Partial<CourseMembership> = {}): CourseMembership => ({
    id: "m1",
    userId: "user-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...over,
  });

  async function available(
    over: Partial<CourseMembership>,
    courseStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" = "PUBLISHED",
  ) {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Intro", courseStatus);
    db.seedMembership(membership(over));
    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );
    if (result.outcome !== "READY") throw new Error(`expected READY, got ${result.outcome}`);
    return result.practiceAvailable;
  }

  it("is true for an active LEARNER of a PUBLISHED Course", async () => {
    expect(await available({})).toBe(true);
  });

  it("is false for management roles, archived membership and non-PUBLISHED Courses (fail closed)", async () => {
    expect(await available({ role: "OWNER" })).toBe(false);
    expect(await available({ role: "INSTRUCTOR" })).toBe(false);
    expect(await available({ archivedAt: new Date("2026-02-01T00:00:00Z") })).toBe(false);
    expect(await available({}, "ARCHIVED")).toBe(false);
    expect(await available({}, "DRAFT")).toBe(false);
  });
});
