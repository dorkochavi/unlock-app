/**
 * Real-Postgres (PGlite) integration tests for Course/Topic Practice
 * (Run UX-02 P2, ADR-020, LEARNING_ENGINE §39A): `selectPracticeBatch` and
 * `submitPracticeAnswer` wired to the REAL repositories, the REAL production
 * engine settings (ts-fsrs scheduler, production policies) and the real
 * `getOrCreateDailyPlanForToday` / `submitAnswer` / Today answer path.
 *
 * Reproduces the accepted P0.7 scenarios S1-S8 in shape (not with the
 * simulation's exact fixture), plus lifecycle/eligibility/race behavior.
 *
 * PGlite limits (stated honestly): single in-process engine — this proves
 * query behavior and sequential lifecycle, NOT true multi-connection
 * concurrency (e.g. Practice vs Today answering the same Question at once).
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { submitDailyPlanItemAnswer } from "../../../src/application/dailyPlan/submit-daily-plan-item-answer";
import { skipDailyPlanItem } from "../../../src/application/dailyPlan/skip-daily-plan-item";
import { submitAnswer } from "../../../src/application/learning/submit-answer";
import type { SelectPracticeBatchPorts } from "../../../src/application/practice/select-practice-batch";
import {
  PRACTICE_BATCH_SIZE,
  selectPracticeBatch,
} from "../../../src/application/practice/select-practice-batch";
import { submitPracticeAnswer } from "../../../src/application/practice/submit-practice-answer";
import { createProductionDailyPlanGenerationSettings } from "../../../src/infrastructure/dailyPlan/composition-root";
import { createProductionSubmitAnswerContext } from "../../../src/infrastructure/learning/composition-root";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PostgresPracticeReadRepository } from "../../../src/infrastructure/postgres/practice-read-repository";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import { PostgresUserQuestionProgressRepository } from "../../../src/infrastructure/postgres/progress-repository";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  pgliteConnectionProvider,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;

const NOW = new Date("2026-03-10T10:00:00Z");
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const settings = createProductionDailyPlanGenerationSettings();

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

function makePorts(): SelectPracticeBatchPorts & { uow: PostgresUnitOfWork } {
  const provider = pgliteConnectionProvider(db);
  const executor = db as never;
  return {
    users: new PostgresUserRepository(executor),
    courseMemberships: new PostgresCourseMembershipRepository(executor),
    courses: new PostgresCourseRepository(executor),
    dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(provider),
    topics: new PostgresTopicRepository(executor),
    practice: new PostgresPracticeReadRepository(executor),
    progress: new PostgresUserQuestionProgressRepository(executor),
    content: new PostgresLearnerQuestionContentRepository(executor),
    uow: new PostgresUnitOfWork(provider),
  };
}

interface World {
  learner: string;
  courseId: string;
  topicA: string;
  topicB: string;
}

async function createWorld(opts: { timezone?: string | null } = {}): Promise<World> {
  const owner = await insertUser(db);
  const learner = await insertUser(db);
  if (opts.timezone !== null) {
    await db.query("update users set timezone = $2 where id = $1", [
      learner,
      opts.timezone ?? "UTC",
    ]);
  }
  const courseId = await insertCourse(db, owner);
  await insertCourseMembership(db, { userId: learner, courseId, role: "LEARNER" });
  const topicA = randomUUID();
  const topicB = randomUUID();
  for (const [id, name] of [
    [topicA, "נושא א"],
    [topicB, "נושא ב"],
  ]) {
    await db.query("insert into topics (id, course_id, name) values ($1, $2, $3)", [
      id,
      courseId,
      name,
    ]);
  }
  return { learner, courseId, topicA, topicB };
}

let createdCounter = 0;
async function addQuestion(
  courseId: string,
  topicId: string | null,
  overrides: { noCurrentVersion?: boolean } = {},
): Promise<{ questionId: string; versionId: string }> {
  const questionId = await insertQuestion(db, courseId);
  // Strictly increasing created_at so ADR-017 order is deterministic.
  createdCounter += 1;
  await db.query("update questions set created_at = $2, topic_id = $3 where id = $1", [
    questionId,
    new Date(Date.UTC(2026, 0, 1, 0, 0, createdCounter)),
    topicId,
  ]);
  const versionId = await insertQuestionVersion(db, questionId);
  if (!overrides.noCurrentVersion) await setCurrentVersion(db, questionId, versionId);
  return { questionId, versionId };
}

/** Real answers via `submitAnswer` in a past learning session (real FSRS/progress). */
async function seedHistory(
  world: World,
  q: { questionId: string; versionId: string },
  answers: Array<{ at: Date; selected: "A" | "B" }>,
) {
  let i = 0;
  for (const answer of answers) {
    i += 1;
    const result = await submitAnswer(
      {
        submissionId: randomUUID(),
        userId: world.learner,
        courseId: world.courseId,
        questionId: q.questionId,
        questionVersionId: q.versionId,
        answeredAt: answer.at,
        selectedAnswer: answer.selected,
        confidenceLevel: null,
        responseTimeSeconds: 20,
        dailyPlanId: null,
        dailyPlanItemId: null,
        learningSessionId: `old-session-${answer.at.toISOString().slice(0, 10)}-${i}`,
        assistanceUsed: "NONE",
        attemptNumberForPresentedItem: 1,
        answerWasRevealedBeforeResponse: false,
      },
      createProductionSubmitAnswerContext(answer.at),
      makePorts().uow,
    );
    expect(result.kind).toBe("ACCEPTED");
  }
}

/** Seen but neither due, lapsed, misconceived nor strengthening -> §39A tier 3 (coverage). */
async function makeCoverageOnly(world: World, questionId: string, dueInDays: number) {
  await db.query(
    `update user_question_progress
        set scheduled_review_at = $3, mastery_category = 'mastered',
            last_lapse_at = null, misconception_state = 'none'
      where user_id = $1 and question_id = $2`,
    [world.learner, questionId, new Date(NOW.getTime() + dueInDays * DAY)],
  );
}

const select = (
  world: World,
  opts: { topicId?: string | null; skipped?: string[]; now?: Date } = {},
) =>
  selectPracticeBatch(
    {
      userId: world.learner,
      courseId: world.courseId,
      topicId: opts.topicId ?? null,
      skippedQuestionIds: opts.skipped ?? [],
      now: opts.now ?? NOW,
    },
    settings,
    makePorts(),
  );

async function readyIds(promise: ReturnType<typeof select>): Promise<string[]> {
  const result = await promise;
  if (result.outcome !== "READY") throw new Error(`expected READY, got ${result.outcome}`);
  return result.items.map((item) => item.questionId);
}

const answerPractice = (
  world: World,
  q: { questionId: string; versionId: string },
  overrides: Partial<Parameters<typeof submitPracticeAnswer>[0]> = {},
) =>
  submitPracticeAnswer(
    {
      userId: world.learner,
      courseId: world.courseId,
      topicId: null,
      questionId: q.questionId,
      questionVersionId: q.versionId,
      submissionId: randomUUID(),
      selectedAnswer: "A",
      confidenceLevel: null,
      responseTimeSeconds: 12,
      now: NOW,
      ...overrides,
    },
    settings,
    createProductionSubmitAnswerContext(overrides.now ?? NOW),
    makePorts(),
  );

async function todayPlan(world: World, now = NOW) {
  const result = await getOrCreateDailyPlanForToday({ userId: world.learner, now }, settings, makePorts());
  if (result.outcome !== "READY") throw new Error(result.outcome);
  return result.plan;
}

async function attemptsFor(userId: string, questionId: string) {
  const r = await db.query<Record<string, unknown>>(
    "select * from attempts where user_id = $1 and question_id = $2 order by created_at",
    [userId, questionId],
  );
  return r.rows;
}

describe("selection order and scope (P0.7 S1/S3/S4 shape)", () => {
  it("orders canonical NBA candidates, then unseen (created_at,id), then broader coverage (earliest due, id)", async () => {
    const world = await createWorld();
    const due = await addQuestion(world.courseId, world.topicA); // seen, long overdue -> NBA
    const unseen1 = await addQuestion(world.courseId, world.topicA);
    const unseen2 = await addQuestion(world.courseId, null);
    const cov1 = await addQuestion(world.courseId, world.topicA); // seen, mastered, due in 60d
    const cov2 = await addQuestion(world.courseId, world.topicA); // due in 30d -> earlier than cov1
    await seedHistory(world, due, [{ at: daysAgo(40), selected: "A" }]);
    await seedHistory(world, cov1, [{ at: daysAgo(40), selected: "A" }]);
    await seedHistory(world, cov2, [{ at: daysAgo(40), selected: "A" }]);
    await makeCoverageOnly(world, cov1.questionId, 60);
    await makeCoverageOnly(world, cov2.questionId, 30);

    // Practice before Today exists: the plan is created by the call.
    const before = await db.query<{ n: number }>("select count(*)::int as n from daily_plans");
    expect(before.rows[0].n).toBe(0);
    const ids = await readyIds(select(world));
    const after = await db.query<{ n: number }>("select count(*)::int as n from daily_plans");
    expect(after.rows[0].n).toBe(1);

    // `due` is ranked (NBA); then unseen; then coverage. (`due` is also in
    // today's plan as pending, so it is EXCLUDED here — see next test for
    // the pending exclusion. cov1/cov2 are not in the plan.)
    expect(ids).toEqual([unseen1.questionId, unseen2.questionId, cov2.questionId, cov1.questionId]);
  });

  it("uses the canonical NBA ranking before unseen when today's plan does not hold the candidate", async () => {
    const world = await createWorld();
    // Fill today's plan cap (15) with more overdue Questions of ANOTHER Course... simpler:
    // make Today's plan generate FIRST (before the seen question exists), then add history.
    const fillerQ = await addQuestion(world.courseId, world.topicB);
    await todayPlan(world); // plan frozen now: empty ranked -> ADR-017 new material (fillerQ pending)
    const due = await addQuestion(world.courseId, world.topicA);
    const unseen = await addQuestion(world.courseId, world.topicA);
    await seedHistory(world, due, [{ at: daysAgo(40), selected: "A" }]);

    const ids = await readyIds(select(world));
    expect(ids).not.toContain(fillerQ.questionId); // pending in Today
    expect(ids).toEqual([due.questionId, unseen.questionId]); // NBA first, unseen second
  });

  it("Topic Practice includes only Questions currently in that active Topic; Topic-less only in Course Practice", async () => {
    const world = await createWorld();
    await todayPlan(world); // empty frozen plan: nothing pending
    const a1 = await addQuestion(world.courseId, world.topicA);
    const a2 = await addQuestion(world.courseId, world.topicA);
    const b1 = await addQuestion(world.courseId, world.topicB);
    const none = await addQuestion(world.courseId, null);
    expect(new Set(await readyIds(select(world)))).toEqual(
      new Set([a1, a2, b1, none].map((q) => q.questionId)),
    );
    expect(await readyIds(select(world, { topicId: world.topicA }))).toEqual([a1.questionId, a2.questionId]);
    expect(await readyIds(select(world, { topicId: world.topicB }))).toEqual([b1.questionId]);
  });

  it("excludes Questions with no current version and Questions of other Courses", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const ok = await addQuestion(world.courseId, null);
    await addQuestion(world.courseId, null, { noCurrentVersion: true });
    const owner2 = await insertUser(db);
    const other = await insertCourse(db, owner2);
    await addQuestion(other, null);
    expect(await readyIds(select(world))).toEqual([ok.questionId]);
  });
});

describe("exclusions: pending Today, answered this learning day, Today-skipped", () => {
  it("excludes pending-Today Questions; a Today-completed Question is excluded as answered this day; a Today-skipped Question stays eligible", async () => {
    const world = await createWorld();
    const qs = [];
    for (let i = 0; i < 3; i++) qs.push(await addQuestion(world.courseId, world.topicA));
    const plan = await todayPlan(world);
    expect(plan.items).toHaveLength(3);
    const [i0, i1, i2] = plan.items;

    // All three pending -> empty pool (S5 shape).
    expect(await readyIds(select(world))).toEqual([]);

    // Complete i0 via the REAL Today answer path.
    const ports = makePorts();
    const answered = await submitDailyPlanItemAnswer(
      {
        userId: world.learner,
        dailyPlanItemId: i0.id,
        submissionId: randomUUID(),
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: 5,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      {
        items: new PostgresDailyPlanRepository(db as never),
        memberships: ports.courseMemberships,
        context: createProductionSubmitAnswerContext(NOW),
        uow: ports.uow,
      },
    );
    expect(answered.kind).toBe("ACCEPTED");

    // Skip i1 via the real Today skip path.
    const skipped = await skipDailyPlanItem(
      { userId: world.learner, dailyPlanItemId: i1.id, skippedAt: NOW },
      { dailyPlanItems: new PostgresDailyPlanRepository(db as never), memberships: ports.courseMemberships },
    );
    expect(skipped.kind).toBe("SKIPPED");

    // i0: answered this learning day (excluded). i1: Today-skipped -> eligible again. i2: still pending.
    const ids = await readyIds(select(world));
    expect(ids).toEqual([i1.questionId]);
    expect(ids).not.toContain(i0.questionId);
    expect(ids).not.toContain(i2.questionId);
  });
});

describe("batches, hasMore, skip hints", () => {
  it("returns up to 10 with hasMore, then the rest without repeats, then RUN010-B reinforcement instead of an empty pool (S6/S7 + FUB-034)", async () => {
    const world = await createWorld();
    await todayPlan(world); // empty frozen plan: no Questions pending
    const qs: Array<{ questionId: string; versionId: string }> = [];
    for (let i = 0; i < 13; i++) qs.push(await addQuestion(world.courseId, world.topicA));

    // Strictly increasing answer times (still the same calendar day/session)
    // so "least-recently-answered first" has a real, non-tied signal to
    // rank on for Tier 4 below — a realistic sequential practice session,
    // not 13 simultaneous answers.
    let minute = 0;
    const nextNow = () => new Date(NOW.getTime() + 60_000 * minute++);

    const first = await select(world);
    if (first.outcome !== "READY") throw new Error("expected READY");
    expect(first.items).toHaveLength(10);
    expect(first.hasMore).toBe(true);
    expect(first.scope).toEqual({ kind: "COURSE", title: "Test Course" });

    for (const item of first.items) {
      const r = await answerPractice(world, { questionId: item.questionId, versionId: item.questionVersionId }, { now: nextNow() });
      expect(r.kind).toBe("ACCEPTED");
    }
    const second = await select(world);
    if (second.outcome !== "READY") throw new Error("expected READY");
    expect(second.items).toHaveLength(3);
    expect(second.hasMore).toBe(false);
    const firstIds = new Set(first.items.map((i) => i.questionId));
    expect(second.items.every((i) => !firstIds.has(i.questionId))).toBe(true);

    for (const item of second.items) {
      await answerPractice(world, { questionId: item.questionId, versionId: item.questionVersionId }, { now: nextNow() });
    }

    // RUN010-B (resolves FUB-034): all 13 Questions in scope have now been
    // answered once today, so Tier 1-3 are genuinely exhausted (not merely
    // "this page is short") -> Tier 4 reinforcement activates instead of
    // the old `NoMore` dead end. The pool is the SAME 13 already-answered
    // Questions, ranked oldest-answered-first, still batched/paginated the
    // same way (10 then 3): the FIRST batch's 10 (answered earliest) come
    // back before the SECOND batch's 3 (answered most recently).
    const allIds = new Set(qs.map((q) => q.questionId));
    const secondIds = new Set(second.items.map((i) => i.questionId));
    const third = await select(world);
    if (third.outcome !== "READY") throw new Error("expected READY");
    expect(third.items).toHaveLength(10);
    expect(third.hasMore).toBe(true);
    expect(third.items.every((i) => allIds.has(i.questionId))).toBe(true);
    expect(third.items.every((i) => firstIds.has(i.questionId))).toBe(true);

    for (const item of third.items) {
      const r = await answerPractice(world, { questionId: item.questionId, versionId: item.questionVersionId }, { now: nextNow() });
      expect(r.kind).toBe("ACCEPTED"); // reinforcement answers are still real Attempts
    }

    // Reinforcement Attempts update `lastAttemptAt`, so `third`'s 10 are now
    // the MOST recently answered and `second`'s 3 are now the LEAST
    // recently answered -> a 4th call ranks `second`'s 3 first again. Still
    // non-empty, still bounded by the real 13-Question scope (never
    // fabricated as literally infinite): this is "genuinely open-ended"
    // via honest rotation, not a second dead end.
    const fourth = await select(world);
    if (fourth.outcome !== "READY") throw new Error("expected READY");
    expect(fourth.items.length).toBeGreaterThan(0);
    expect(fourth.items.length).toBeLessThanOrEqual(PRACTICE_BATCH_SIZE);
    expect(fourth.items.every((i) => allIds.has(i.questionId))).toBe(true);
    expect(fourth.items.slice(0, secondIds.size).every((i) => secondIds.has(i.questionId))).toBe(true);
  });

  it("exactly 10 remaining -> hasMore is false; a fewer-than-10 pool is honest", async () => {
    const world = await createWorld();
    await todayPlan(world);
    for (let i = 0; i < 10; i++) await addQuestion(world.courseId, world.topicA);
    const r = await select(world);
    if (r.outcome !== "READY") throw new Error("READY");
    expect(r.items).toHaveLength(10);
    expect(r.hasMore).toBe(false);
  });

  it("skip hints only narrow: excluded ids vanish, foreign/unknown ids add nothing (S8)", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const a = await addQuestion(world.courseId, world.topicA);
    const b = await addQuestion(world.courseId, world.topicA);
    const otherOwner = await insertUser(db);
    const otherCourse = await insertCourse(db, otherOwner);
    const foreign = await addQuestion(otherCourse, null);

    const skipped = await readyIds(select(world, { skipped: [a.questionId, foreign.questionId, randomUUID(), "not-a-uuid"] }));
    expect(skipped).toEqual([b.questionId]);
    // A skip creates no evidence.
    expect(await attemptsFor(world.learner, a.questionId)).toHaveLength(0);
    const progress = await db.query<{ n: number }>("select count(*)::int as n from user_question_progress");
    expect(progress.rows[0].n).toBe(0);
  });
});

describe("eligibility fails closed (and never creates a plan)", () => {
  async function planCount() {
    const r = await db.query<{ n: number }>("select count(*)::int as n from daily_plans");
    return r.rows[0].n as number;
  }

  it.each([
    ["revoked membership", async (w: World) => db.query("update course_memberships set revoked_at = now() where user_id = $1", [w.learner])],
    ["archived membership (ADR-020 §7)", async (w: World) => db.query("update course_memberships set archived_at = now() where user_id = $1", [w.learner])],
    ["non-LEARNER role", async (w: World) => db.query("update course_memberships set role = 'INSTRUCTOR' where user_id = $1", [w.learner])],
    ["ARCHIVED Course", async (w: World) => db.query("update courses set status = 'ARCHIVED' where id = $1", [w.courseId])],
    ["DRAFT Course", async (w: World) => db.query("update courses set status = 'DRAFT' where id = $1", [w.courseId])],
    ["no membership", async (w: World) => db.query("delete from course_memberships where user_id = $1", [w.learner])],
  ])("%s -> NOT_ELIGIBLE for selection and answer", async (_name, mutate) => {
    const world = await createWorld();
    const q = await addQuestion(world.courseId, world.topicA);
    await mutate(world);
    expect((await select(world)).outcome).toBe("NOT_ELIGIBLE");
    expect(await answerPractice(world, q)).toEqual({ kind: "NOT_ELIGIBLE" });
    expect(await planCount()).toBe(0);
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
  });

  it("malformed / foreign Course and Topic ids fail closed without a DB crash", async () => {
    const world = await createWorld();
    const other = await createWorld();
    expect((await selectPracticeBatch({ userId: world.learner, courseId: "nope", topicId: null, skippedQuestionIds: [], now: NOW }, settings, makePorts())).outcome).toBe("NOT_ELIGIBLE");
    expect((await select(world, { topicId: "nope" })).outcome).toBe("TOPIC_NOT_FOUND");
    expect((await select(world, { topicId: randomUUID() })).outcome).toBe("TOPIC_NOT_FOUND");
    expect((await select(world, { topicId: other.topicA })).outcome).toBe("TOPIC_NOT_FOUND");
    await db.query("update topics set archived_at = now() where id = $1", [world.topicA]);
    expect((await select(world, { topicId: world.topicA })).outcome).toBe("TOPIC_NOT_FOUND");
  });

  it("TIMEZONE_NOT_SET is surfaced for selection and answer, with no plan and no Attempt", async () => {
    const world = await createWorld({ timezone: null });
    const q = await addQuestion(world.courseId, world.topicA);
    expect((await select(world)).outcome).toBe("TIMEZONE_NOT_SET");
    expect(await answerPractice(world, q)).toEqual({ kind: "TIMEZONE_NOT_SET" });
    expect(await planCount()).toBe(0);
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
  });
});

describe("Practice answer path", () => {
  it("creates a normal Attempt with the server-derived learning-day session, never resolves or changes the plan", async () => {
    const world = await createWorld();
    const pendingQ = await addQuestion(world.courseId, world.topicA);
    const plan = await todayPlan(world); // pendingQ is pending in Today
    const q = await addQuestion(world.courseId, world.topicA); // added after freeze

    const result = await answerPractice(world, q, { topicId: world.topicA });
    expect(result).toMatchObject({ kind: "ACCEPTED", isCorrect: true, wasIdempotentRetry: false });

    const [attempt] = await attemptsFor(world.learner, q.questionId);
    expect(attempt.learning_session_id).toBe(plan.id);
    expect(attempt.daily_plan_id).toBeNull();
    expect(attempt.daily_plan_item_id).toBeNull();
    expect(new Date(attempt.answered_at as string).getTime()).toBe(NOW.getTime());
    expect(attempt.engine_version).toBe("learning-engine-v2");

    // Plan untouched (frozen, same items/statuses), and re-fetching it gives the same plan.
    const again = await todayPlan(world);
    expect(again.id).toBe(plan.id);
    expect(again.items.map((i) => [i.questionId, i.status])).toEqual(
      plan.items.map((i) => [i.questionId, i.status]),
    );
    expect(again.items.map((i) => i.questionId)).toEqual([pendingQ.questionId]);

    // Same Question is excluded from first-pass (Tier 1-3) selection for the
    // rest of the learning day: with `pendingQ` still pending (never
    // eligible for Practice) and `q` now answered, the first-pass pool is
    // genuinely empty, so RUN010-B Tier 4 reinforcement is the only reason
    // `q` can still appear here — not a first-pass repeat.
    expect(await readyIds(select(world))).toEqual([q.questionId]);
  });

  it("is idempotent by submissionId (same command)", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const q = await addQuestion(world.courseId, null);
    const submissionId = randomUUID();
    const first = await answerPractice(world, q, { submissionId });
    const retry = await answerPractice(world, q, { submissionId });
    expect(first).toMatchObject({ kind: "ACCEPTED", wasIdempotentRetry: false });
    expect(retry).toMatchObject({ kind: "ACCEPTED", wasIdempotentRetry: true });
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(1);
  });

  it("rejects a Question still pending in Today (409 outcome) with no Attempt", async () => {
    const world = await createWorld();
    const q = await addQuestion(world.courseId, world.topicA);
    const plan = await todayPlan(world);
    expect(plan.items.map((i) => i.questionId)).toContain(q.questionId);
    expect(await answerPractice(world, q)).toEqual({ kind: "PENDING_IN_TODAY" });
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
    expect((await todayPlan(world)).items[0].status).toBe("pending");
  });

  it("rejects wrong scope: other Course's Question, other Topic, unknown ids", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const inA = await addQuestion(world.courseId, world.topicA);
    const otherOwner = await insertUser(db);
    const otherCourse = await insertCourse(db, otherOwner);
    const foreign = await addQuestion(otherCourse, null);

    expect(await answerPractice(world, foreign)).toEqual({ kind: "NOT_IN_SCOPE" });
    expect(await answerPractice(world, inA, { topicId: world.topicB })).toEqual({ kind: "NOT_IN_SCOPE" });
    expect(await answerPractice(world, inA, { topicId: randomUUID() })).toEqual({ kind: "NOT_IN_SCOPE" });
    expect(await answerPractice(world, { questionId: randomUUID(), versionId: randomUUID() })).toEqual({ kind: "NOT_IN_SCOPE" });
    expect(await answerPractice(world, { questionId: "x", versionId: "y" })).toEqual({ kind: "NOT_IN_SCOPE" });
    expect(await attemptsFor(world.learner, inA.questionId)).toHaveLength(0);
    expect(await attemptsFor(world.learner, foreign.questionId)).toHaveLength(0);
  });

  it("version race: answering a superseded version is QUESTION_UNAVAILABLE with no evidence; a Question that lost its current version is out of scope", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const q = await addQuestion(world.courseId, world.topicA);
    const v2 = await insertQuestionVersion(db, q.questionId, 2);
    await setCurrentVersion(db, q.questionId, v2);

    expect(await answerPractice(world, q)).toEqual({ kind: "QUESTION_UNAVAILABLE" }); // stale v1
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
    // Selection serves the CURRENT version.
    const r = await select(world);
    if (r.outcome !== "READY") throw new Error("READY");
    expect(r.items.map((i) => i.questionVersionId)).toEqual([v2]);
    expect((await answerPractice(world, { questionId: q.questionId, versionId: v2 })).kind).toBe("ACCEPTED");

    // Unpublished (no current version) mid-run.
    const q2 = await addQuestion(world.courseId, world.topicA);
    await db.query("update questions set current_version_id = null where id = $1", [q2.questionId]);
    expect(await answerPractice(world, q2)).toEqual({ kind: "NOT_IN_SCOPE" });
  });

  it("eligibility is re-checked at answer time (revoked after selection)", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const q = await addQuestion(world.courseId, null);
    expect(await readyIds(select(world))).toEqual([q.questionId]);
    await db.query("update course_memberships set revoked_at = now() where user_id = $1", [world.learner]);
    expect(await answerPractice(world, q)).toEqual({ kind: "NOT_ELIGIBLE" });
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
  });

  it("invalid selectedAnswer is a validation outcome, not an Attempt", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const q = await addQuestion(world.courseId, null);
    const r = await answerPractice(world, q, { selectedAnswer: "ZZZ" });
    expect(r.kind).toBe("INVALID_SELECTED_ANSWER");
    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(0);
  });
});

describe("learning-engine-v2 through the Practice path (real engine, real DB)", () => {
  it("early correct Practice answer keeps the scheduled review; early incorrect pulls it earlier; Course and Topic Practice use the same engine", async () => {
    const world = await createWorld();
    await todayPlan(world); // freeze an empty plan for today so nothing is pending
    const early = await addQuestion(world.courseId, world.topicA);
    const wrong = await addQuestion(world.courseId, world.topicB);
    // Two spaced correct answers => a scheduled review well in the future.
    for (const q of [early, wrong]) {
      await seedHistory(world, q, [
        { at: daysAgo(30), selected: "A" },
        { at: daysAgo(20), selected: "A" },
      ]);
    }
    const dueOf = async (questionId: string) =>
      new Date(
        (
          await db.query<Record<string, unknown>>(
            "select scheduled_review_at from user_question_progress where user_id = $1 and question_id = $2",
            [world.learner, questionId],
          )
        ).rows[0].scheduled_review_at as string,
      ).getTime();
    const dueBefore = await dueOf(early.questionId);
    expect(dueBefore).toBeGreaterThan(NOW.getTime()); // genuinely early

    // Course Practice: early correct -> schedule unchanged.
    const ok = await answerPractice(world, early, { selectedAnswer: "A" });
    expect(ok).toMatchObject({ kind: "ACCEPTED", isCorrect: true });
    expect(await dueOf(early.questionId)).toBe(dueBefore);

    // Topic Practice: early incorrect -> normal review, pulled earlier.
    const wrongDueBefore = await dueOf(wrong.questionId);
    const bad = await answerPractice(world, wrong, { selectedAnswer: "B", topicId: world.topicB });
    expect(bad).toMatchObject({ kind: "ACCEPTED", isCorrect: false });
    expect(await dueOf(wrong.questionId)).toBeLessThan(wrongDueBefore);
  });
});

describe("RUN010-B — same-day reinforcement (Tier 4, resolves FUB-034)", () => {
  it("Topic Practice continues via reinforcement once its own Topic is exhausted, WITHOUT leaking into another Topic or affecting Course Practice (still fresh elsewhere)", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const a1 = await addQuestion(world.courseId, world.topicA);
    const a2 = await addQuestion(world.courseId, world.topicA);
    const b1 = await addQuestion(world.courseId, world.topicB);
    const b2 = await addQuestion(world.courseId, world.topicB);
    const none = await addQuestion(world.courseId, null);

    // Exhaust Topic A only.
    for (const q of [a1, a2]) {
      const r = await answerPractice(world, q, { topicId: world.topicA });
      expect(r.kind).toBe("ACCEPTED");
    }

    // Topic A: Tier 1-3 exhausted -> Tier 4 reinforcement kicks in, scoped
    // to Topic A ONLY (never b1/b2/none).
    const topicAResult = await select(world, { topicId: world.topicA });
    if (topicAResult.outcome !== "READY") throw new Error("expected READY");
    expect(topicAResult.items.length).toBeGreaterThan(0);
    expect(new Set(topicAResult.items.map((i) => i.questionId))).toEqual(
      new Set([a1.questionId, a2.questionId]),
    );

    // Topic B: completely untouched, still fresh (no reinforcement leak).
    const topicBResult = await select(world, { topicId: world.topicB });
    if (topicBResult.outcome !== "READY") throw new Error("expected READY");
    expect(new Set(topicBResult.items.map((i) => i.questionId))).toEqual(
      new Set([b1.questionId, b2.questionId]),
    );

    // Course Practice: b1/b2/none are still fresh, so Tier 1-3 are NOT
    // exhausted at Course scope -> no reinforcement contamination; a1/a2
    // (already answered) must not reappear here either.
    const courseResult = await select(world);
    if (courseResult.outcome !== "READY") throw new Error("expected READY");
    const courseIds = new Set(courseResult.items.map((i) => i.questionId));
    expect(courseIds).toEqual(new Set([b1.questionId, b2.questionId, none.questionId]));
    expect(courseIds.has(a1.questionId)).toBe(false);
    expect(courseIds.has(a2.questionId)).toBe(false);
  });

  it("small scope (a single Question): repeats it as the only coherent fallback, indefinitely and without error", async () => {
    const world = await createWorld();
    await todayPlan(world);
    const only = await addQuestion(world.courseId, null);

    const first = await select(world);
    if (first.outcome !== "READY") throw new Error("expected READY");
    expect(first.items.map((i) => i.questionId)).toEqual([only.questionId]);

    // Answer it, then confirm Practice keeps offering the SAME single
    // Question (never an empty/`NoMore` pool merely because a repeat is
    // unavoidable), across several more rounds.
    for (let round = 0; round < 3; round++) {
      const r = await answerPractice(world, only, { now: new Date(NOW.getTime() + round * 60_000) });
      expect(r.kind).toBe("ACCEPTED");
      const again = await select(world, { now: new Date(NOW.getTime() + round * 60_000) });
      if (again.outcome !== "READY") throw new Error("expected READY");
      expect(again.items).toHaveLength(1);
      expect(again.items[0].questionId).toBe(only.questionId);
      expect(again.hasMore).toBe(false);
    }
    const attempts = await attemptsFor(world.learner, only.questionId);
    expect(attempts).toHaveLength(3); // 3 rounds, each a real reinforcement Attempt
  });

  it("never returns the just-answered Question first when a genuine alternative exists, even if that alternative is lower ranked by evidence", async () => {
    const world = await createWorld();
    await todayPlan(world); // empty frozen plan: Questions below are added after freeze
    const strongerButOlder = await addQuestion(world.courseId, null);
    const weakerButJustAnswered = await addQuestion(world.courseId, null);

    // Answer the first one correctly (becomes "older" reinforcement evidence).
    await answerPractice(world, strongerButOlder, { selectedAnswer: "A", now: NOW });
    // Answer the second one INCORRECTLY, most recently — by raw
    // weak-evidence-first priority this would rank FIRST, but it is also
    // the literal Question the learner just finished.
    const justAnsweredAt = new Date(NOW.getTime() + 5 * 60_000);
    await answerPractice(world, weakerButJustAnswered, {
      selectedAnswer: "B",
      now: justAnsweredAt,
    });

    const result = await select(world, { now: justAnsweredAt });
    if (result.outcome !== "READY") throw new Error("expected READY");
    expect(result.items.map((i) => i.questionId)).toEqual([
      strongerButOlder.questionId,
      weakerButJustAnswered.questionId,
    ]);
  });

  it("reinforcement Attempts are real, immutable evidence — repeating the SAME Question does not fabricate extra mastery/spaced-retrieval evidence, and Today's plan stays untouched", async () => {
    const world = await createWorld();
    const pendingToday = await addQuestion(world.courseId, world.topicA);
    const plan = await todayPlan(world); // pendingToday is pending in Today
    const q = await addQuestion(world.courseId, world.topicA);

    let now = NOW;
    for (let i = 0; i < 5; i++) {
      const r = await answerPractice(world, q, { topicId: world.topicA, selectedAnswer: "A", now });
      expect(r.kind).toBe("ACCEPTED");
      now = new Date(now.getTime() + 60_000);
    }

    const attempts = await attemptsFor(world.learner, q.questionId);
    expect(attempts).toHaveLength(5); // every real answer creates its own canonical Attempt

    const progressRow = await db.query<Record<string, unknown>>(
      "select attempt_count, correct_count, successful_spaced_retrievals, mastery_category, lapse_count from user_question_progress where user_id = $1 and question_id = $2",
      [world.learner, q.questionId],
    );
    const row = progressRow.rows[0];
    expect(row.attempt_count).toBe(5);
    expect(row.correct_count).toBe(5);
    // Anti-inflation (Part 1 Q4/Q5): 5 same-session correct repeats never
    // qualify as spaced retrievals (they are all the SAME learning
    // session), so they cannot manufacture the longitudinal evidence
    // mastery/"strengthening" require — this would fail if a learner could
    // grind one Question 5x and be treated as having mastered it.
    expect(row.successful_spaced_retrievals).toBe(0);
    expect(row.mastery_category).toBe("learning");
    expect(row.lapse_count).toBe(0);

    // Today's plan is untouched: still exactly the one pending item,
    // never resolved by any of the 5 Practice reinforcement answers.
    const stillToday = await todayPlan(world);
    expect(stillToday.id).toBe(plan.id);
    expect(stillToday.items.map((i) => [i.questionId, i.status])).toEqual([
      [pendingToday.questionId, "pending"],
    ]);
  });

  it("a repeated same-day INCORRECT reinforcement Attempt does not retrigger a second scheduler review/lapse", async () => {
    const world = await createWorld();
    await todayPlan(world); // freezes an empty plan for NOW's calendar day
    const q = await addQuestion(world.courseId, null);
    // One clean Practice answer, well in the past, establishes scheduler
    // memory; then a direct update pins scheduled_review_at to exactly NOW
    // (same calendar day as the already-frozen plan above) — avoids
    // depending on ts-fsrs's actual interval math to land "due today",
    // matching this file's own `makeCoverageOnly` precedent for
    // deterministic due-date control.
    await seedHistory(world, q, [{ at: daysAgo(10), selected: "A" }]);
    await db.query(
      "update user_question_progress set scheduled_review_at = $3 where user_id = $1 and question_id = $2",
      [world.learner, q.questionId, NOW],
    );
    const dueOf = async () =>
      new Date(
        (
          await db.query<Record<string, unknown>>(
            "select scheduled_review_at from user_question_progress where user_id = $1 and question_id = $2",
            [world.learner, q.questionId],
          )
        ).rows[0].scheduled_review_at as string,
      ).getTime();
    const lapseCountOf = async () =>
      (
        await db.query<{ lapse_count: number }>(
          "select lapse_count from user_question_progress where user_id = $1 and question_id = $2",
          [world.learner, q.questionId],
        )
      ).rows[0].lapse_count;

    // First Attempt today: genuinely due (answeredAt === scheduledReviewAt)
    // -> a real review (correct, GOOD).
    const first = await answerPractice(world, q, { selectedAnswer: "A", now: NOW });
    expect(first).toMatchObject({ kind: "ACCEPTED", isCorrect: true });
    const dueAfterFirst = await dueOf();
    expect(dueAfterFirst).toBeGreaterThan(NOW.getTime());

    // Same-day reinforcement, WRONG this time: must not re-invoke the
    // scheduler or record a second lapse.
    const reinforcedAt = new Date(NOW.getTime() + 60_000);
    const second = await answerPractice(world, q, { selectedAnswer: "B", now: reinforcedAt });
    expect(second).toMatchObject({ kind: "ACCEPTED", isCorrect: false });
    expect(await dueOf()).toBe(dueAfterFirst); // unchanged
    expect(await lapseCountOf()).toBe(0);

    expect(await attemptsFor(world.learner, q.questionId)).toHaveLength(3); // 1 seeded + first (due review) + second (reinforcement)
  });
});
