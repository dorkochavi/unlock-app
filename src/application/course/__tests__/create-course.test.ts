import { describe, expect, it } from "vitest";

import { createCourse } from "../create-course";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("createCourse", () => {
  it("creates a new Course as DRAFT/AUTHORIZED_ONLY and grants the creator OWNER", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await createCourse(
      { actorUserId: "user-1", title: "Intro to Economics", examDate: "2026-11-12" },
      db.uow(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome !== "CREATED") throw new Error("unreachable");
    expect(result.course.status).toBe("DRAFT");
    expect(result.course.joinPolicy).toBe("AUTHORIZED_ONLY");
    expect(result.course.title).toBe("Intro to Economics");
    expect(result.course.examDate).toBe("2026-11-12");

    const membership = await db
      .repos()
      .memberships.findMembership("user-1", result.course.id);
    expect(membership?.role).toBe("OWNER");
    expect(membership?.revokedAt).toBeNull();
    expect(membership?.archivedAt).toBeNull();
  });

  it("trims the title and allows a null exam date", async () => {
    const db = new InMemoryCourseDatabase();
    const result = await createCourse(
      { actorUserId: "user-1", title: "  Spaced Title  ", examDate: null },
      db.uow(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome !== "CREATED") throw new Error("unreachable");
    expect(result.course.title).toBe("Spaced Title");
    expect(result.course.examDate).toBeNull();
  });

  it("rejects an empty/whitespace-only title", async () => {
    const db = new InMemoryCourseDatabase();
    const result = await createCourse(
      { actorUserId: "user-1", title: "   ", examDate: null },
      db.uow(),
    );

    expect(result.outcome).toBe("INVALID_TITLE");
  });
});
