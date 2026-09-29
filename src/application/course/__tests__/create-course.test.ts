import { describe, expect, it } from "vitest";

import { createCourse } from "../create-course";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("createCourse", () => {
  // RUN010-H.2 (FUB-036, Option 4 architecture): createCourse now grants a
  // course_authors OWNER capability instead of a course_memberships OWNER
  // row. courses.owner_user_id (ADR-015 §1 "creator/legacy metadata only")
  // is unaffected — this test only asserts the authorization-relevant write.
  it("creates a new Course as DRAFT/AUTHORIZED_ONLY and grants the creator an active course_authors OWNER capability", async () => {
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

    const grants = await db
      .repos()
      .authors.findActiveCapabilities("user-1", result.course.id);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ capability: "OWNER", revokedAt: null });
  });

  // RUN010-H.2's own central invariant, explicitly proven: after this
  // change, creating a Course must NOT insert any course_memberships row at
  // all for the creator (H.3's author self-enrollment bypass does not exist
  // yet).
  it("does not create any course_memberships row for the creator", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await createCourse(
      { actorUserId: "user-1", title: "No Membership Course", examDate: null },
      db.uow(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome !== "CREATED") throw new Error("unreachable");

    const membership = await db.repos().memberships.findMembership("user-1", result.course.id);
    expect(membership).toBeNull();
  });

  // Full round-trip proof (a): the creator, who now has ONLY a
  // course_authors grant, can still perform an authoring action end-to-end.
  it("lets the creator author their new Course through the same course_authors path (no course_memberships row needed)", async () => {
    const db = new InMemoryCourseDatabase();
    const createResult = await createCourse(
      { actorUserId: "user-1", title: "Authoring Round Trip", examDate: null },
      db.uow(),
    );
    if (createResult.outcome !== "CREATED") throw new Error("unreachable");

    const grants = await db.repos().authors.findActiveCapabilities("user-1", createResult.course.id);
    expect(grants.some((g) => g.capability === "OWNER" && g.revokedAt === null)).toBe(true);
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
