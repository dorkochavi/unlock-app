import { describe, expect, it } from "vitest";

import {
  canAuthorCourse,
  canSelfJoin,
  canSelfJoinCourse,
  COURSE_JOIN_POLICIES,
  COURSE_ROLES,
  COURSE_STATUSES,
  type CourseMembership,
  hasAccess,
  isActiveMembership,
  isManagementRole,
} from "../types";

function membership(overrides: Partial<CourseMembership> = {}): CourseMembership {
  return {
    id: "membership-1",
    userId: "user-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("isManagementRole", () => {
  it("is true for OWNER and INSTRUCTOR", () => {
    expect(isManagementRole("OWNER")).toBe(true);
    expect(isManagementRole("INSTRUCTOR")).toBe(true);
  });

  it("is false for LEARNER", () => {
    expect(isManagementRole("LEARNER")).toBe(false);
  });

  it("covers every role value exhaustively", () => {
    for (const role of COURSE_ROLES) {
      expect(typeof isManagementRole(role)).toBe("boolean");
    }
  });
});

describe("hasAccess", () => {
  it("is true when revokedAt is null", () => {
    expect(hasAccess(membership({ revokedAt: null }))).toBe(true);
  });

  it("is false once revokedAt is set", () => {
    expect(
      hasAccess(membership({ revokedAt: new Date("2026-02-01T00:00:00Z") })),
    ).toBe(false);
  });

  it("is unaffected by archivedAt", () => {
    expect(
      hasAccess(
        membership({
          revokedAt: null,
          archivedAt: new Date("2026-02-01T00:00:00Z"),
        }),
      ),
    ).toBe(true);
  });
});

describe("isActiveMembership", () => {
  it("is true for a non-revoked, non-archived membership", () => {
    expect(isActiveMembership(membership())).toBe(true);
  });

  it("is false once archived, even with access intact", () => {
    expect(
      isActiveMembership(
        membership({ archivedAt: new Date("2026-02-01T00:00:00Z") }),
      ),
    ).toBe(false);
  });

  it("is false once revoked, even if never archived", () => {
    expect(
      isActiveMembership(
        membership({ revokedAt: new Date("2026-02-01T00:00:00Z") }),
      ),
    ).toBe(false);
  });

  it("is false when both revoked and archived", () => {
    expect(
      isActiveMembership(
        membership({
          revokedAt: new Date("2026-02-01T00:00:00Z"),
          archivedAt: new Date("2026-02-02T00:00:00Z"),
        }),
      ),
    ).toBe(false);
  });
});

describe("canSelfJoin", () => {
  it("allows self-join for OPEN", () => {
    expect(canSelfJoin("OPEN")).toBe(true);
  });

  it("never allows self-join for AUTHORIZED_ONLY in V1", () => {
    expect(canSelfJoin("AUTHORIZED_ONLY")).toBe(false);
  });

  it("covers every join-policy value exhaustively", () => {
    for (const policy of COURSE_JOIN_POLICIES) {
      expect(typeof canSelfJoin(policy)).toBe("boolean");
    }
  });
});

describe("canSelfJoinCourse", () => {
  it("allows self-join for a PUBLISHED OPEN course", () => {
    expect(canSelfJoinCourse({ status: "PUBLISHED", joinPolicy: "OPEN" })).toBe(true);
  });

  it("blocks self-join for a DRAFT course even when OPEN", () => {
    expect(canSelfJoinCourse({ status: "DRAFT", joinPolicy: "OPEN" })).toBe(false);
  });

  it("blocks self-join for an ARCHIVED course even when OPEN", () => {
    expect(canSelfJoinCourse({ status: "ARCHIVED", joinPolicy: "OPEN" })).toBe(false);
  });

  it("blocks self-join for a PUBLISHED AUTHORIZED_ONLY course", () => {
    expect(canSelfJoinCourse({ status: "PUBLISHED", joinPolicy: "AUTHORIZED_ONLY" })).toBe(false);
  });

  it("covers every status/join-policy combination exhaustively", () => {
    for (const status of COURSE_STATUSES) {
      for (const policy of COURSE_JOIN_POLICIES) {
        expect(typeof canSelfJoinCourse({ status, joinPolicy: policy })).toBe("boolean");
      }
    }
  });
});

describe("canAuthorCourse", () => {
  it("allows an active OWNER", () => {
    expect(canAuthorCourse(membership({ role: "OWNER" }))).toBe(true);
  });

  it("allows an active INSTRUCTOR", () => {
    expect(canAuthorCourse(membership({ role: "INSTRUCTOR" }))).toBe(true);
  });

  it("blocks a LEARNER", () => {
    expect(canAuthorCourse(membership({ role: "LEARNER" }))).toBe(false);
  });

  it("fails closed for a revoked OWNER", () => {
    expect(
      canAuthorCourse(
        membership({ role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") }),
      ),
    ).toBe(false);
  });

  it("fails closed for an archived INSTRUCTOR, even though isManagementRole alone would allow it", () => {
    expect(
      canAuthorCourse(
        membership({ role: "INSTRUCTOR", archivedAt: new Date("2026-02-01T00:00:00Z") }),
      ),
    ).toBe(false);
  });
});
