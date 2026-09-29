import { describe, expect, it } from "vitest";

import {
  canAuthorCourse,
  canSelfJoin,
  canSelfJoinCourse,
  COURSE_JOIN_POLICIES,
  COURSE_ROLES,
  COURSE_STATUSES,
  type CourseAuthorGrant,
  type CourseMembership,
  hasAccess,
  hasActiveAuthorGrant,
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

function grant(overrides: Partial<CourseAuthorGrant> = {}): CourseAuthorGrant {
  return {
    id: "grant-1",
    userId: "user-1",
    courseId: "course-1",
    capability: "OWNER",
    grantedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    ...overrides,
  };
}

/**
 * RUN010-H.2 — mirrors `RUN010-H.1`'s real migration backfill exactly
 * (`supabase/migrations/20260929010000_course_authors_v1.sql`'s own
 * `insert into course_authors ... select ... from course_memberships where
 * role in ('OWNER', 'INSTRUCTOR')`): an OWNER/INSTRUCTOR membership backfills
 * one grant preserving `revokedAt`; a LEARNER membership backfills nothing;
 * `archivedAt` is never consulted (no equivalent column exists).
 */
function backfillGrants(m: CourseMembership): CourseAuthorGrant[] {
  if (!isManagementRole(m.role)) return [];
  return [
    grant({
      userId: m.userId,
      courseId: m.courseId,
      capability: m.role as "OWNER" | "INSTRUCTOR",
      grantedAt: m.joinedAt,
      revokedAt: m.revokedAt,
    }),
  ];
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

describe("hasActiveAuthorGrant (RUN010-H.2)", () => {
  it("is false for an empty grant list", () => {
    expect(hasActiveAuthorGrant([])).toBe(false);
  });

  it("is true when at least one grant is active", () => {
    expect(hasActiveAuthorGrant([grant()])).toBe(true);
  });

  it("is false when the only grant is revoked", () => {
    expect(
      hasActiveAuthorGrant([grant({ revokedAt: new Date("2026-02-01T00:00:00Z") })]),
    ).toBe(false);
  });

  it("is true if any grant among several is active, even if others are revoked", () => {
    expect(
      hasActiveAuthorGrant([
        grant({ capability: "INSTRUCTOR", revokedAt: new Date("2026-02-01T00:00:00Z") }),
        grant({ capability: "OWNER", revokedAt: null }),
      ]),
    ).toBe(true);
  });

  it("re-checks revokedAt itself rather than trusting the caller pre-filtered", () => {
    // A hand-built array containing an already-revoked grant must not be
    // treated as authorizing, even though a real repository's
    // `findActiveCapabilities` would never return one.
    expect(
      hasActiveAuthorGrant([grant({ revokedAt: new Date("2026-01-15T00:00:00Z") })]),
    ).toBe(false);
  });
});

/**
 * RUN010-H.2's own required verification: for every realistic
 * membership/capability combination, the OLD authorization check
 * (`canAuthorCourse` over `course_memberships`) and the NEW one
 * (`hasActiveAuthorGrant` over `course_authors`, populated exactly the way
 * RUN010-H.1's real migration backfill populates it) must agree — except for
 * the one documented, intentional, accepted divergence: `course_authors` has
 * no `archivedAt` concept, so an archived-but-not-revoked management
 * membership is blocked by the OLD check but allowed by the NEW one. That
 * one case is asserted explicitly as a DIVERGENCE, not silently skipped.
 */
describe("Authorization equivalence: canAuthorCourse (old) vs. hasActiveAuthorGrant (new, post-backfill)", () => {
  const scenarios: Array<{ name: string; membership: CourseMembership; expectDivergence: boolean }> = [
    { name: "active OWNER", membership: membership({ role: "OWNER" }), expectDivergence: false },
    { name: "active INSTRUCTOR", membership: membership({ role: "INSTRUCTOR" }), expectDivergence: false },
    { name: "active LEARNER", membership: membership({ role: "LEARNER" }), expectDivergence: false },
    {
      name: "revoked OWNER",
      membership: membership({ role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: false,
    },
    {
      name: "revoked INSTRUCTOR",
      membership: membership({ role: "INSTRUCTOR", revokedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: false,
    },
    {
      name: "revoked LEARNER",
      membership: membership({ role: "LEARNER", revokedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: false,
    },
    {
      name: "archived (not revoked) LEARNER",
      membership: membership({ role: "LEARNER", archivedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: false,
    },
    {
      name: "archived (not revoked) OWNER — KNOWN DIVERGENCE",
      membership: membership({ role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: true,
    },
    {
      name: "archived (not revoked) INSTRUCTOR — KNOWN DIVERGENCE",
      membership: membership({ role: "INSTRUCTOR", archivedAt: new Date("2026-02-01T00:00:00Z") }),
      expectDivergence: true,
    },
    {
      name: "archived AND revoked OWNER",
      membership: membership({
        role: "OWNER",
        revokedAt: new Date("2026-02-01T00:00:00Z"),
        archivedAt: new Date("2026-02-02T00:00:00Z"),
      }),
      expectDivergence: false,
    },
  ];

  it.each(scenarios)("$name", ({ membership: m, expectDivergence }) => {
    const oldResult = canAuthorCourse(m);
    const newResult = hasActiveAuthorGrant(backfillGrants(m));

    if (expectDivergence) {
      expect(newResult).not.toBe(oldResult);
      // The only accepted shape of divergence: OLD denies, NEW allows.
      expect(oldResult).toBe(false);
      expect(newResult).toBe(true);
    } else {
      expect(newResult).toBe(oldResult);
    }
  });

  it("a freshly-created-post-H.2 Course's creator (no course_memberships row at all) is authorized purely via course_authors", () => {
    // No membership exists — `backfillGrants` has nothing to derive from, so
    // this directly seeds the grant the way `create-course.ts` now does.
    const freshGrant = grant({ userId: "new-owner", courseId: "course-2", capability: "OWNER" });
    expect(hasActiveAuthorGrant([freshGrant])).toBe(true);
  });

  it("a LEARNER-only actor with no course_authors grant at all is NOT authorized (negative proof)", () => {
    expect(hasActiveAuthorGrant(backfillGrants(membership({ role: "LEARNER" })))).toBe(false);
  });
});
