/**
 * Real-Postgres (PGlite) integration proof for UX-03-QA1 Finding 5:
 * "randomize ties, not learning priorities." Two properties, against the
 * REAL `selectPracticeBatch` and a real migrated schema:
 *
 * 1. A REMEDIATION-tier candidate (RELEARN_LAPSE — real unresolved-lapse
 *    evidence, written through the real `UserQuestionProgressRepository`)
 *    is NEVER outranked by any Tier-2 unseen candidate, regardless of
 *    Topic-interleaving. This is the Run brief's own explicit acceptance
 *    scenario: "a lower-priority Question is not promoted above a
 *    higher-priority Question merely for randomness."
 * 2. Tier-2 unseen candidates, when they span multiple Topics created in a
 *    raw "all of Topic A, then all of Topic B" import order, are returned
 *    Topic-interleaved rather than in that raw clumped order.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { selectPracticeBatch } from "../../../src/application/practice/select-practice-batch";
import { createProductionDailyPlanGenerationSettings } from "../../../src/infrastructure/dailyPlan/composition-root";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
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
const settings = createProductionDailyPlanGenerationSettings();

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

function ports() {
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

describe("selectPracticeBatch Topic-interleave (UX-03-QA1 Finding 5, real Postgres)", () => {
  it("Tier 1 (RELEARN_LAPSE, real unresolved-lapse evidence via the real repository) is never outranked by Tier 2 unseen Questions", async () => {
    const owner = await insertUser(db);
    const learner = await insertUser(db);
    await db.query("update users set timezone = 'UTC' where id = $1", [learner]);
    const courseId = await insertCourse(db, owner);
    await insertCourseMembership(db, { userId: learner, courseId, role: "LEARNER" });

    // Freeze an EMPTY Today plan for the day BEFORE any progress/Question
    // exists (ADR-016: no automatic carry-over once a plan is frozen) — the
    // real Today generation uses the SAME NBA ranking, so without this the
    // lapse candidate below would land as a PENDING Today item instead, and
    // Practice correctly excludes anything pending in Today (it would not
    // be "outranked," it would be legitimately absent for an unrelated
    // reason this test does not exist to prove).
    const emptyPlanForLapseCase = await getOrCreateDailyPlanForToday(
      { userId: learner, now: NOW },
      settings,
      ports(),
    );
    if (emptyPlanForLapseCase.outcome !== "READY" || emptyPlanForLapseCase.plan.items.length !== 0) {
      throw new Error("test setup: expected an empty frozen Today plan before seeding evidence");
    }

    // One Question with real, persisted UNRESOLVED-LAPSE evidence — written
    // through the REAL `UserQuestionProgressRepository.upsert`, using
    // exactly the precondition `deriveHasUnresolvedLapse` (lapse.ts, shared
    // verbatim by next-best-action.ts's own RELEARN_LAPSE candidate) defines:
    // `lastLapseAt !== null && retrievalBaselineAt === null`. This isolates
    // the ordering guarantee this test exists to prove from FSRS
    // scheduling/session timing, which is already covered elsewhere
    // (`lapse.test.ts`, `next-best-action.test.ts`, the golden scenarios).
    const lapseQuestionId = await insertQuestion(db, courseId);
    await db.query("update questions set created_at = $2 where id = $1", [
      lapseQuestionId,
      new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
    ]);
    const lapseVersionId = await insertQuestionVersion(db, lapseQuestionId, 1, {
      correctOptionIds: ["A"],
    });
    await setCurrentVersion(db, lapseQuestionId, lapseVersionId);
    await ports().progress.upsert({
      userId: learner,
      questionId: lapseQuestionId,
      attemptCount: 1,
      correctCount: 0,
      lastAttemptAt: NOW,
      lastCorrectAt: null,
      lastIncorrectAt: NOW,
      memory: null,
      retrievalBaselineAt: null,
      retrievalBaselineLearningSessionId: null,
      successfulSpacedRetrievals: 0,
      lapseCount: 1,
      lastLapseAt: NOW,
      misconceptionState: "none",
      misconceptionScore: 0,
      misconceptionLastSeenAt: null,
      timedAttemptCount: 0,
      averageResponseTimeSeconds: null,
      meaningfulAttemptCount: 1,
      assistedAttemptCount: 0,
      lowQualityAttemptCount: 0,
      invalidForMasteryAttemptCount: 0,
      firstMeaningfulEvidenceAt: NOW,
      lastMeaningfulEvidenceAt: NOW,
      evidenceStrength: "early",
      masteryCategory: "learning",
      engineVersion: "test-fixture-v1",
      updatedAt: NOW,
    });

    // Five more fresh, never-attempted Questions -> pure Tier 2.
    for (let i = 0; i < 5; i++) {
      const questionId = await insertQuestion(db, courseId);
      await db.query("update questions set created_at = $2 where id = $1", [
        questionId,
        new Date(Date.UTC(2026, 0, 2, 0, 0, i)),
      ]);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
    }

    const batch = await selectPracticeBatch(
      { userId: learner, courseId, topicId: null, skippedQuestionIds: [], now: NOW },
      settings,
      ports(),
    );
    if (batch.outcome !== "READY") throw new Error(batch.outcome);

    const ids = batch.items.map((item) => item.questionId);
    expect(ids).toContain(lapseQuestionId);
    // The exact acceptance scenario: Tier 1 (remediation) is never
    // outranked by Tier 2 (unseen), no matter how Tier 2 is interleaved.
    expect(ids[0]).toBe(lapseQuestionId);
  });

  it("Tier 2 unseen Questions spanning multiple Topics are returned Topic-interleaved, not in raw creation/import order", async () => {
    const owner = await insertUser(db);
    const learner = await insertUser(db);
    await db.query("update users set timezone = 'UTC' where id = $1", [learner]);
    const courseId = await insertCourse(db, owner);
    await insertCourseMembership(db, { userId: learner, courseId, role: "LEARNER" });

    // Freeze an EMPTY Today plan for the day BEFORE seeding any Question
    // below (ADR-016: a plan normally freezes once generated, no automatic
    // carry-over of later-created content) — this isolates the assertion
    // from Today's own New Material fallback, which would otherwise pull
    // some of these Questions into Today's plan (excluding them from the
    // Practice pool) purely because of an unrelated internal plan-size
    // constant this test must not need to know about.
    const emptyPlan = await getOrCreateDailyPlanForToday(
      { userId: learner, now: NOW },
      settings,
      ports(),
    );
    if (emptyPlan.outcome !== "READY" || emptyPlan.plan.items.length !== 0) {
      throw new Error("test setup: expected an empty frozen Today plan before seeding Questions");
    }

    const topicAId = randomUUID();
    const topicBId = randomUUID();
    await db.query("insert into topics (id, course_id, name) values ($1, $2, 'נושא א')", [
      topicAId,
      courseId,
    ]);
    await db.query("insert into topics (id, course_id, name) values ($1, $2, 'נושא ב')", [
      topicBId,
      courseId,
    ]);

    // Raw import-order clumping: ALL of Topic A created first, then ALL of
    // Topic B — exactly the pattern the product owner observed.
    const topicAQuestionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const questionId = await insertQuestion(db, courseId);
      await db.query("update questions set created_at = $2, topic_id = $3 where id = $1", [
        questionId,
        new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        topicAId,
      ]);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
      topicAQuestionIds.push(questionId);
    }
    const topicBQuestionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const questionId = await insertQuestion(db, courseId);
      await db.query("update questions set created_at = $2, topic_id = $3 where id = $1", [
        questionId,
        new Date(Date.UTC(2026, 0, 1, 0, 1, i)), // one minute later, still all after every Topic-A row
        topicBId,
      ]);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
      topicBQuestionIds.push(questionId);
    }

    const batch = await selectPracticeBatch(
      { userId: learner, courseId, topicId: null, skippedQuestionIds: [], now: NOW },
      settings,
      ports(),
    );
    if (batch.outcome !== "READY") throw new Error(batch.outcome);

    const topicSequence = batch.items.map((item) => item.topicId);
    // Raw creation order would be [A,A,A,B,B,B] — the reported bias.
    expect(topicSequence).not.toEqual([topicAId, topicAId, topicAId, topicBId, topicBId, topicBId]);
    // Interleaved: Topic A appears first (created first) alternating with B.
    expect(topicSequence).toEqual([topicAId, topicBId, topicAId, topicBId, topicAId, topicBId]);
    // Nothing dropped/duplicated.
    expect(batch.items.map((i) => i.questionId).sort()).toEqual(
      [...topicAQuestionIds, ...topicBQuestionIds].sort(),
    );
  });
});
