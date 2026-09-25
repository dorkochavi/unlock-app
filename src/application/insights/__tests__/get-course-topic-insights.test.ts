import { describe, expect, it, vi } from "vitest";

import type { CourseMembership, CourseStatus } from "../../../domain/course/types";
import { getCourseTopicInsights } from "../get-course-topic-insights";
import type { ItemAnalysisRepositories, TopicFirstAttemptStats } from "../ports";

const NOW = new Date("2026-09-25T09:00:00Z");

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

function row(overrides: Partial<TopicFirstAttemptStats> = {}): TopicFirstAttemptStats {
  return {
    topicId: "t-1",
    topicName: "Algebra",
    topicArchived: false,
    distinctResponderCount: 22,
    firstAttemptCount: 60,
    correctAttemptCount: 45,
    ...overrides,
  };
}

function repos(opts: {
  membership?: CourseMembership | null;
  status?: CourseStatus | null;
  activeLearners?: number;
  rows?: TopicFirstAttemptStats[];
}) {
  const findMembership = vi.fn(async () =>
    opts.membership === undefined ? membership() : opts.membership,
  );
  const listStatuses = vi.fn(async () =>
    opts.status === null
      ? []
      : [{ id: "course-1", status: opts.status ?? ("PUBLISHED" as CourseStatus) }],
  );
  const countActiveLearners = vi.fn(async () => opts.activeLearners ?? 30);
  const listTopicFirstAttemptStats = vi.fn(async () => opts.rows ?? [row()]);
  const value = {
    memberships: { findMembership },
    courses: { listStatuses },
    itemAnalysis: { countActiveLearners, listTopicFirstAttemptStats },
  } as unknown as ItemAnalysisRepositories;
  return { value, listStatuses, countActiveLearners, listTopicFirstAttemptStats };
}

const COMMAND = { actorUserId: "actor-1", courseId: "course-1", now: NOW };

describe("getCourseTopicInsights — authorization (fail closed)", () => {
  it.each([
    ["no membership", null],
    ["LEARNER", membership({ role: "LEARNER" })],
    ["archived LEARNER", membership({ role: "LEARNER", archivedAt: new Date("2026-02-01T00:00:00Z") })],
    ["revoked INSTRUCTOR", membership({ revokedAt: new Date("2026-02-01T00:00:00Z") })],
    ["revoked OWNER", membership({ role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") })],
  ])("%s -> NOT_AUTHORIZED, no Course/aggregate reads", async (_label, m) => {
    const r = repos({ membership: m });
    expect(await getCourseTopicInsights(COMMAND, r.value)).toEqual({ outcome: "NOT_AUTHORIZED" });
    expect(r.listStatuses).not.toHaveBeenCalled();
    expect(r.countActiveLearners).not.toHaveBeenCalled();
    expect(r.listTopicFirstAttemptStats).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "INSTRUCTOR"] as const)("%s is authorized", async (role) => {
    const result = await getCourseTopicInsights(COMMAND, repos({ membership: membership({ role }) }).value);
    expect(result.outcome).toBe("READY");
  });

  it.each(["DRAFT", "ARCHIVED"] as const)("%s Course -> COURSE_NOT_ACTIVE, no aggregate reads", async (status) => {
    const r = repos({ status });
    expect(await getCourseTopicInsights(COMMAND, r.value)).toEqual({ outcome: "COURSE_NOT_ACTIVE" });
    expect(r.listTopicFirstAttemptStats).not.toHaveBeenCalled();
  });

  it("missing Course row -> COURSE_NOT_ACTIVE (fail closed)", async () => {
    expect(await getCourseTopicInsights(COMMAND, repos({ status: null }).value)).toEqual({
      outcome: "COURSE_NOT_ACTIVE",
    });
  });
});

describe("getCourseTopicInsights — read model (F-02 contract)", () => {
  it("eligible Topic: band only; echoes read time", async () => {
    // 45 of 60 correct: 135 > 120 -> MOSTLY_CORRECT
    expect(await getCourseTopicInsights(COMMAND, repos({}).value)).toEqual({
      outcome: "READY",
      generatedAt: NOW,
      topics: [
        { topicId: "t-1", name: "Algebra", archived: false, disclosure: "ELIGIBLE", band: "MOSTLY_CORRECT" },
      ],
    });
  });

  it("never returns a count, percentage, identity, or per-option field", async () => {
    const result = await getCourseTopicInsights(COMMAND, repos({}).value);
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(Object.keys(result.topics[0]).sort()).toEqual(
      ["archived", "band", "disclosure", "name", "topicId"].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /responder|attempt|correctAttempt|incorrect|percent|"rate"|stats|userId|actor-1/i,
    );
  });

  it("bands use the pooled attempt counts, with exactly 1/3 and 2/3 as MIXED", async () => {
    const bandFor = async (correct: number, total: number) => {
      const result = await getCourseTopicInsights(
        COMMAND,
        repos({ rows: [row({ firstAttemptCount: total, correctAttemptCount: correct })] }).value,
      );
      if (result.outcome !== "READY") throw new Error("expected READY");
      return result.topics[0].band;
    };
    expect(await bandFor(20, 30)).toBe("MIXED"); // exactly 2/3
    expect(await bandFor(21, 30)).toBe("MOSTLY_CORRECT");
    expect(await bandFor(10, 30)).toBe("MIXED"); // exactly 1/3
    expect(await bandFor(9, 30)).toBe("MOSTLY_INCORRECT");
  });

  it("eligibility uses DISTINCT responders, not pooled attempts: many attempts by 4 learners stay suppressed", async () => {
    const result = await getCourseTopicInsights(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 4, firstAttemptCount: 40, correctAttemptCount: 40 })] }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.topics[0]).toMatchObject({ disclosure: "INSUFFICIENT_DATA", band: null });
  });

  it("exactly 5 responders and 5 active learners disclose; 4 of either suppress", async () => {
    const at = await getCourseTopicInsights(
      COMMAND,
      repos({ activeLearners: 5, rows: [row({ distinctResponderCount: 5 })] }).value,
    );
    const smallCourse = await getCourseTopicInsights(COMMAND, repos({ activeLearners: 4 }).value);
    const fewResponders = await getCourseTopicInsights(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 4 })] }).value,
    );
    if (at.outcome !== "READY" || smallCourse.outcome !== "READY" || fewResponders.outcome !== "READY") {
      throw new Error("expected READY");
    }
    expect(at.topics[0].disclosure).toBe("ELIGIBLE");
    expect(smallCourse.topics[0]).toMatchObject({ disclosure: "INSUFFICIENT_DATA", band: null });
    expect(fewResponders.topics[0]).toMatchObject({ disclosure: "INSUFFICIENT_DATA", band: null });
  });

  it("zero-evidence Topic is listed as INSUFFICIENT_DATA (no classification)", async () => {
    const result = await getCourseTopicInsights(
      COMMAND,
      repos({ rows: [row({ distinctResponderCount: 0, firstAttemptCount: 0, correctAttemptCount: 0 })] }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toMatchObject({ disclosure: "INSUFFICIENT_DATA", band: null });
  });

  it("null-Topic bucket is kept (never silently dropped) and archived Topic stays distinct and flagged", async () => {
    const result = await getCourseTopicInsights(
      COMMAND,
      repos({
        rows: [
          row({ topicId: "t-1", topicName: "Algebra" }),
          row({ topicId: "t-9", topicName: "Retired", topicArchived: true }),
          row({ topicId: null, topicName: null }),
        ],
      }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.topics.map((t) => [t.topicId, t.name, t.archived])).toEqual([
      ["t-1", "Algebra", false],
      ["t-9", "Retired", true],
      [null, null, false],
    ]);
    expect(result.topics.every((t) => t.disclosure === "ELIGIBLE")).toBe(true);
  });

  it("no Topics with published Questions -> READY with an empty list", async () => {
    expect(await getCourseTopicInsights(COMMAND, repos({ rows: [] }).value)).toEqual({
      outcome: "READY",
      generatedAt: NOW,
      topics: [],
    });
  });
});
