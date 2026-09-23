import { describe, expect, it, vi } from "vitest";

import type { CourseMembership } from "../../../domain/course/types";
import type { CourseStatus } from "../../../domain/course/types";
import { getCourseItemAnalysis } from "../get-course-item-analysis";
import type { CurrentVersionItemStats, ItemAnalysisRepositories } from "../ports";

const NOW = new Date("2026-09-24T09:00:00Z");

function membership(overrides: Partial<CourseMembership> = {}): CourseMembership {
  return {
    id: "m-1",
    userId: "actor-1",
    courseId: "course-1",
    role: "INSTRUCTOR",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function row(overrides: Partial<CurrentVersionItemStats> = {}): CurrentVersionItemStats {
  return {
    questionId: "q-1",
    questionVersionId: "qv-1",
    prompt: "What is 2 + 3?",
    distinctResponderCount: 22,
    correctCount: 13,
    ...overrides,
  };
}

function repos(opts: {
  membership?: CourseMembership | null;
  status?: CourseStatus | null;
  activeLearners?: number;
  rows?: CurrentVersionItemStats[];
}) {
  const findMembership = vi.fn(async () =>
    opts.membership === undefined ? membership() : opts.membership,
  );
  const listStatuses = vi.fn(async () =>
    opts.status === null ? [] : [{ id: "course-1", status: opts.status ?? ("PUBLISHED" as CourseStatus) }],
  );
  const countActiveLearners = vi.fn(async () => opts.activeLearners ?? 30);
  const listCurrentVersionItemStats = vi.fn(async () => opts.rows ?? [row()]);
  const value = {
    memberships: { findMembership },
    courses: { listStatuses },
    itemAnalysis: { countActiveLearners, listCurrentVersionItemStats },
  } as unknown as ItemAnalysisRepositories;
  return { value, findMembership, listStatuses, countActiveLearners, listCurrentVersionItemStats };
}

const COMMAND = { actorUserId: "actor-1", courseId: "course-1", now: NOW };

describe("getCourseItemAnalysis — authorization (fail closed)", () => {
  it.each([
    ["no membership", null],
    ["LEARNER", membership({ role: "LEARNER" })],
    ["revoked INSTRUCTOR", membership({ revokedAt: new Date("2026-02-01T00:00:00Z") })],
    ["archived OWNER", membership({ role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") })],
  ])("%s -> NOT_AUTHORIZED, no Course/aggregate reads", async (_label, m) => {
    const r = repos({ membership: m });
    const result = await getCourseItemAnalysis(COMMAND, r.value);
    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
    expect(r.listStatuses).not.toHaveBeenCalled();
    expect(r.countActiveLearners).not.toHaveBeenCalled();
    expect(r.listCurrentVersionItemStats).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "INSTRUCTOR"] as const)("%s is authorized", async (role) => {
    const result = await getCourseItemAnalysis(COMMAND, repos({ membership: membership({ role }) }).value);
    expect(result.outcome).toBe("READY");
  });
});

describe("getCourseItemAnalysis — active Course", () => {
  it.each(["DRAFT", "ARCHIVED"] as const)("%s Course -> COURSE_NOT_ACTIVE, no aggregate reads", async (status) => {
    const r = repos({ status });
    expect(await getCourseItemAnalysis(COMMAND, r.value)).toEqual({ outcome: "COURSE_NOT_ACTIVE" });
    expect(r.listCurrentVersionItemStats).not.toHaveBeenCalled();
  });

  it("missing Course row -> COURSE_NOT_ACTIVE (fail closed)", async () => {
    expect(await getCourseItemAnalysis(COMMAND, repos({ status: null }).value)).toEqual({
      outcome: "COURSE_NOT_ACTIVE",
    });
  });
});

describe("getCourseItemAnalysis — read model", () => {
  it("eligible item: responder count and a coarse incorrect-rate bucket only; echoes read time", async () => {
    const result = await getCourseItemAnalysis(COMMAND, repos({}).value);
    expect(result).toEqual({
      outcome: "READY",
      generatedAt: NOW,
      items: [
        {
          questionId: "q-1",
          questionVersionId: "qv-1",
          prompt: "What is 2 + 3?",
          disclosure: "ELIGIBLE",
          // 9/22 = 40.9% -> nearest 10 = 40
          stats: { distinctResponderCount: 22, approximateIncorrectRatePercent: 40 },
        },
      ],
    });
  });

  it("never exposes exact correct/incorrect counts or an exact percent", async () => {
    const result = await getCourseItemAnalysis(COMMAND, repos({}).value);
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(Object.keys(result.items[0].stats ?? {}).sort()).toEqual([
      "approximateIncorrectRatePercent",
      "distinctResponderCount",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/correctCount|incorrectCount|incorrectRatePercent"/);
  });

  it.each([
    // [responders, correct, expected bucketed incorrect %]
    [20, 20, 0],
    [20, 19, 10], // 5% rounds half up
    [20, 13, 40], // 35% rounds half up
    [20, 12, 40], // 40%
    [20, 11, 50], // 45% rounds half up
    [20, 10, 50],
    [20, 0, 100],
    [7, 4, 40], // 42.86%
    [5, 1, 80],
  ])("%s responders, %s correct -> approximate incorrect rate %s%%", async (responders, correct, expected) => {
    const result = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: responders, correctCount: correct })] }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.items[0].stats?.approximateIncorrectRatePercent).toBe(expected);
  });

  it("a single learner's answer flipping within a bucket is not visible across refreshes", async () => {
    const before = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 20, correctCount: 13 })] }).value,
    );
    const after = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 20, correctCount: 12 })] }).value,
    );
    if (before.outcome !== "READY" || after.outcome !== "READY") throw new Error("expected READY");
    expect(after.items[0].stats).toEqual(before.items[0].stats);
  });

  it("Course too small: every item suppressed with stats null (no numbers leak)", async () => {
    const result = await getCourseItemAnalysis(COMMAND, repos({ activeLearners: 4 }).value);
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.items[0].disclosure).toBe("INSUFFICIENT_COURSE_SIZE");
    expect(result.items[0].stats).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/22|13/);
  });

  it("4 responders in a large Course: suppressed; 5 responders: disclosed", async () => {
    const low = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 4, correctCount: 1 })] }).value,
    );
    const at = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 5, correctCount: 1 })] }).value,
    );
    if (low.outcome !== "READY" || at.outcome !== "READY") throw new Error("expected READY");
    expect(low.items[0]).toMatchObject({ disclosure: "INSUFFICIENT_RESPONSES", stats: null });
    expect(at.items[0]).toMatchObject({ disclosure: "ELIGIBLE" });
    expect(at.items[0].stats).toEqual({ distinctResponderCount: 5, approximateIncorrectRatePercent: 80 });
  });

  it("zero-response current Question appears as not-yet-eligible with no numbers", async () => {
    const result = await getCourseItemAnalysis(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 0, correctCount: 0 })] }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ disclosure: "INSUFFICIENT_RESPONSES", stats: null });
  });

  it("no published Questions -> READY with empty items", async () => {
    const result = await getCourseItemAnalysis(COMMAND, repos({ rows: [] }).value);
    expect(result).toEqual({ outcome: "READY", generatedAt: NOW, items: [] });
  });

  it("output carries no learner identity fields", async () => {
    const result = await getCourseItemAnalysis(COMMAND, repos({}).value);
    expect(JSON.stringify(result)).not.toMatch(/userId|user_id|actor-1/);
  });
});
