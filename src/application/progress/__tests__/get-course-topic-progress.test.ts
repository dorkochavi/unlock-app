import { describe, expect, it, vi } from "vitest";

import type { CourseMembership, CourseStatus } from "../../../domain/course/types";
import type { TopicQuestionLearnerState } from "../../../domain/progress/topic-progress";
import { getCourseTopicProgress } from "../get-course-topic-progress";
import type { LearnerCourseQuestionRow, LearnerTopicProgressRepositories } from "../ports";

function membership(overrides: Partial<CourseMembership> = {}): CourseMembership {
  return {
    id: "m-1",
    userId: "actor-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

const strongAttempt: TopicQuestionLearnerState = {
  attempted: true,
  progress: {
    masteryCategory: "mastered",
    misconceptionState: "none",
    lastLapseAt: null,
    retrievalBaselineAt: null,
  },
};
const unseen: TopicQuestionLearnerState = { attempted: false, progress: null };

let n = 0;
function row(
  topic: { id: string; name: string; archived?: boolean } | null,
  learnerState: TopicQuestionLearnerState,
): LearnerCourseQuestionRow {
  n += 1;
  return {
    questionId: `q-${n}`,
    topicId: topic?.id ?? null,
    topicName: topic?.name ?? null,
    topicArchived: topic?.archived ?? false,
    learnerState,
  };
}

function repos(opts: {
  membership?: CourseMembership | null;
  status?: CourseStatus | null;
  rows?: LearnerCourseQuestionRow[];
}) {
  const findMembership = vi.fn(async () =>
    opts.membership === undefined ? membership() : opts.membership,
  );
  const listStatuses = vi.fn(async () =>
    opts.status === null
      ? []
      : [{ id: "course-1", status: opts.status ?? ("PUBLISHED" as CourseStatus) }],
  );
  const listCourseQuestionsForLearner = vi.fn(async () => opts.rows ?? []);
  const value = {
    memberships: { findMembership },
    courses: { listStatuses },
    topicProgress: { listCourseQuestionsForLearner },
  } as unknown as LearnerTopicProgressRepositories;
  return { value, findMembership, listStatuses, listCourseQuestionsForLearner };
}

const COMMAND = { actorUserId: "actor-1", courseId: "course-1" };

describe("getCourseTopicProgress — authorization (fail closed)", () => {
  it.each([
    ["no membership", null],
    ["revoked learner", membership({ revokedAt: new Date("2026-02-01T00:00:00Z") })],
    ["OWNER (not treated as a learner)", membership({ role: "OWNER" })],
    ["INSTRUCTOR (not treated as a learner)", membership({ role: "INSTRUCTOR" })],
  ])("%s -> NOT_AUTHORIZED, no Course/progress read", async (_label, m) => {
    const r = repos({ membership: m });
    expect(await getCourseTopicProgress(COMMAND, r.value)).toEqual({ outcome: "NOT_AUTHORIZED" });
    expect(r.listStatuses).not.toHaveBeenCalled();
    expect(r.listCourseQuestionsForLearner).not.toHaveBeenCalled();
  });

  it.each([
    ["active learner", membership()],
    // ADR-015 §7/§8: archiving only leaves the active learning set; access remains.
    ["archived non-revoked learner", membership({ archivedAt: new Date("2026-02-01T00:00:00Z") })],
  ])("%s -> authorized (READY)", async (_label, m) => {
    const r = repos({ membership: m });
    expect(await getCourseTopicProgress(COMMAND, r.value)).toMatchObject({ outcome: "READY" });
    expect(r.listCourseQuestionsForLearner).toHaveBeenCalledWith("actor-1", "course-1");
  });

  it("looks up the membership for the actor and reads only the actor's own state", async () => {
    const r = repos({});
    await getCourseTopicProgress(COMMAND, r.value);
    expect(r.findMembership).toHaveBeenCalledWith("actor-1", "course-1");
    expect(r.listCourseQuestionsForLearner).toHaveBeenCalledWith("actor-1", "course-1");
  });

  it.each<CourseStatus>(["DRAFT", "ARCHIVED"])("%s Course -> COURSE_NOT_ACTIVE", async (status) => {
    expect(await getCourseTopicProgress(COMMAND, repos({ status }).value)).toEqual({
      outcome: "COURSE_NOT_ACTIVE",
    });
  });

  it("missing Course row -> COURSE_NOT_ACTIVE", async () => {
    expect(await getCourseTopicProgress(COMMAND, repos({ status: null }).value)).toEqual({
      outcome: "COURSE_NOT_ACTIVE",
    });
  });
});

describe("getCourseTopicProgress — READY", () => {
  it("groups by Topic, keeps repository order, and reports coverage counts", async () => {
    const a = { id: "t-a", name: "Alpha" };
    const b = { id: "t-b", name: "Beta" };
    const result = await getCourseTopicProgress(
      COMMAND,
      repos({ rows: [row(a, strongAttempt), row(a, unseen), row(b, unseen)] }).value,
    );
    expect(result).toEqual({
      outcome: "READY",
      topics: [
        { topicId: "t-a", name: "Alpha", state: "IN_PROGRESS", attemptedCount: 1, totalCount: 2 },
        { topicId: "t-b", name: "Beta", state: "NOT_STARTED", attemptedCount: 0, totalCount: 1 },
      ],
    });
  });

  it("no Topics/Questions -> READY with an empty list", async () => {
    expect(await getCourseTopicProgress(COMMAND, repos({ rows: [] }).value)).toEqual({
      outcome: "READY",
      topics: [],
    });
  });

  it("null-Topic Questions never surface as an Uncategorized Topic", async () => {
    const t = { id: "t-a", name: "Alpha" };
    const result = await getCourseTopicProgress(
      COMMAND,
      repos({ rows: [row(null, strongAttempt), row(t, strongAttempt)] }).value,
    );
    expect(result).toMatchObject({
      outcome: "READY",
      topics: [{ topicId: "t-a", state: "SOLID", totalCount: 1 }],
    });
  });

  it("archived Topics are omitted and do not affect other Topics' coverage", async () => {
    const live = { id: "t-a", name: "Alpha" };
    const archived = { id: "t-z", name: "Zeta", archived: true };
    const result = await getCourseTopicProgress(
      COMMAND,
      repos({ rows: [row(archived, strongAttempt), row(live, unseen)] }).value,
    );
    expect(result).toEqual({
      outcome: "READY",
      topics: [
        { topicId: "t-a", name: "Alpha", state: "NOT_STARTED", attemptedCount: 0, totalCount: 1 },
      ],
    });
  });

  it("DTO carries no percentage/score field", async () => {
    const t = { id: "t-a", name: "Alpha" };
    const result = await getCourseTopicProgress(
      COMMAND,
      repos({ rows: [row(t, strongAttempt)] }).value,
    );
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(Object.keys(result.topics[0]).sort()).toEqual(
      ["attemptedCount", "name", "state", "topicId", "totalCount"].sort(),
    );
  });
});
