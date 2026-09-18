/**
 * Real schema verification — runs the actual initial migration against a
 * real (WASM, in-process) PostgreSQL engine via `@electric-sql/pglite`, and
 * proves the DB itself rejects the invalid rows/operations this migration
 * is supposed to make impossible, and accepts a representative valid chain.
 *
 * This is deliberately NOT part of the main `npm test` suite (see
 * `supabase/vitest.config.ts` / `package.json`'s `test:schema` script) —
 * it is materially heavier (spins up a real Postgres engine per test) and
 * is infrastructure verification, not domain/application unit testing.
 * `src/domain/**` / `src/application/**` in-memory tests do NOT exercise
 * real database constraints; this file exists specifically because that
 * gap is real (see the task that produced this file: "Application
 * in-memory tests do NOT prove database constraint behavior").
 *
 * pglite is a genuine PostgreSQL build (currently PG18, compiled to WASM),
 * not a mock/stub — every constraint violation asserted below is Postgres
 * itself rejecting the statement, not a hand-written approximation of one.
 * What this file does NOT prove: Supabase-specific behavior (RLS policy
 * evaluation depends on Supabase's `auth.uid()`/role-switching machinery,
 * which stock pglite does not provide — RLS is only checked here for
 * "enables without error," not for actual allow/deny behavior under a
 * simulated `anon`/`authenticated` role) or anything requiring the real
 * managed Supabase platform. Those remain real Postgres instance /
 * Supabase project verification for the next checkpoint.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(dir, "../migrations");

/**
 * Applies EVERY migration in `supabase/migrations/`, in filename
 * (timestamp-prefixed, so lexicographic === chronological) order — not
 * just the first one. This is also what proves the full migration chain
 * applies cleanly from an empty database; a second migration
 * (`20260918000000_question_answer_model_v1.sql`, ADR-014) was added
 * after this file was first written, and this loader was fixed to pick it
 * up rather than silently continuing to test only the first migration in
 * isolation.
 */
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n");

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(MIGRATION_SQL);
});

// ---------------------------------------------------------------------------
// Seed helpers — each returns the id it inserted. Defaults produce ONE
// valid, mutually-consistent chain; individual fields are overridden per
// test to construct the specific invalid case under test.
// ---------------------------------------------------------------------------

async function insertUser(): Promise<string> {
  const id = randomUUID();
  await db.query("insert into users (id) values ($1)", [id]);
  return id;
}

async function insertCourse(ownerUserId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into courses (id, owner_user_id, title) values ($1, $2, 'Test Course')",
    [id, ownerUserId],
  );
  return id;
}

async function insertQuestion(courseId: string): Promise<string> {
  const id = randomUUID();
  await db.query("insert into questions (id, course_id) values ($1, $2)", [
    id,
    courseId,
  ]);
  return id;
}

async function insertQuestionVersion(
  questionId: string,
  versionNumber = 1,
): Promise<string> {
  const id = randomUUID();
  // ADR-014 shape: answer_options is an array of {id, content}; correct_answer
  // is always an array of option ids (here, a single-entry SINGLE_CHOICE).
  await db.query(
    `insert into question_versions
       (id, question_id, version_number, prompt, question_type, answer_options, correct_answer)
     values ($1, $2, $3, 'Prompt?', 'SINGLE_CHOICE',
       '[{"id":"a","content":"A"},{"id":"b","content":"B"}]'::jsonb, '["a"]'::jsonb)`,
    [id, questionId, versionNumber],
  );
  return id;
}

async function insertTodaySession(
  userId: string,
  courseId: string,
  plannedForDate = "2026-01-10",
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into today_sessions
       (id, user_id, course_id, planned_for_date, status, engine_version)
     values ($1, $2, $3, $4, 'prepared', 'test-engine-v1')`,
    [id, userId, courseId, plannedForDate],
  );
  return id;
}

async function insertTodaySessionItem(args: {
  todaySessionId: string;
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  position?: number;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into today_session_items
       (id, today_session_id, user_id, course_id, position, question_id, question_version_id,
        action_type, tier)
     values ($1, $2, $3, $4, $5, $6, $7, 'REVIEW_DUE', 'DUE_REVIEW')`,
    [
      id,
      args.todaySessionId,
      args.userId,
      args.courseId,
      args.position ?? 0,
      args.questionId,
      args.questionVersionId,
    ],
  );
  return id;
}

async function insertDailyPlan(
  userId: string,
  plannedForDate = "2026-01-10",
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into daily_plans
       (id, user_id, planned_for_date, status, engine_version)
     values ($1, $2, $3, 'prepared', 'test-engine-v1')`,
    [id, userId, plannedForDate],
  );
  return id;
}

async function insertDailyPlanItem(args: {
  dailyPlanId: string;
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  position?: number;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into daily_plan_items
       (id, daily_plan_id, user_id, course_id, position, question_id, question_version_id,
        action_type, tier)
     values ($1, $2, $3, $4, $5, $6, $7, 'REVIEW_DUE', 'DUE_REVIEW')`,
    [
      id,
      args.dailyPlanId,
      args.userId,
      args.courseId,
      args.position ?? 0,
      args.questionId,
      args.questionVersionId,
    ],
  );
  return id;
}

interface AttemptOverrides {
  id?: string;
  submissionId?: string;
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  todaySessionItemId?: string | null;
  todaySessionId?: string | null;
}

async function insertAttempt(args: AttemptOverrides): Promise<string> {
  const id = args.id ?? randomUUID();
  await db.query(
    `insert into attempts
       (id, submission_id, user_id, course_id, question_id, question_version_id,
        today_session_item_id, today_session_id, answered_at, is_correct,
        attempt_number_for_presented_item, engine_version)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now(), true, 1, 'test-engine-v1')`,
    [
      id,
      args.submissionId ?? randomUUID(),
      args.userId,
      args.courseId,
      args.questionId,
      args.questionVersionId,
      args.todaySessionItemId ?? null,
      args.todaySessionId ?? null,
    ],
  );
  return id;
}

async function insertValidProgress(
  userId: string,
  questionId: string,
): Promise<void> {
  await db.query(
    `insert into user_question_progress
       (user_id, question_id, attempt_count, correct_count,
        meaningful_attempt_count, assisted_attempt_count,
        low_quality_attempt_count, invalid_for_mastery_attempt_count,
        engine_version)
     values ($1, $2, 3, 2, 3, 0, 0, 0, 'test-engine-v1')`,
    [userId, questionId],
  );
}

async function insertCourseMembership(args: {
  id?: string;
  userId: string;
  courseId: string;
  role?: string;
  revokedAt?: string | null;
  archivedAt?: string | null;
}): Promise<string> {
  const id = args.id ?? randomUUID();
  await db.query(
    `insert into course_memberships (id, user_id, course_id, role, revoked_at, archived_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      args.userId,
      args.courseId,
      args.role ?? "LEARNER",
      args.revokedAt ?? null,
      args.archivedAt ?? null,
    ],
  );
  return id;
}

/** One full valid chain: user, course, question, version, Today session+item. */
async function seedValidChain() {
  const userId = await insertUser();
  const courseId = await insertCourse(userId);
  const questionId = await insertQuestion(courseId);
  const questionVersionId = await insertQuestionVersion(questionId);
  const todaySessionId = await insertTodaySession(userId, courseId);
  const todaySessionItemId = await insertTodaySessionItem({
    todaySessionId,
    userId,
    courseId,
    questionId,
    questionVersionId,
  });
  return {
    userId,
    courseId,
    questionId,
    questionVersionId,
    todaySessionId,
    todaySessionItemId,
  };
}

describe("initial schema — real PostgreSQL constraint verification (pglite)", () => {
  it("migration applies cleanly against a real PostgreSQL engine", async () => {
    const version = await db.query<{ version: string }>("select version()");
    expect(version.rows[0].version).toMatch(/PostgreSQL/);
  });

  it("1. rejects a duplicate (user_id, submission_id)", async () => {
    const chain = await seedValidChain();
    const submissionId = "sub-1";
    await insertAttempt({ ...chain, submissionId });

    await expect(
      insertAttempt({ ...chain, submissionId }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("2. rejects a TodaySessionItem whose questionVersionId belongs to a DIFFERENT Question", async () => {
    const chain = await seedValidChain();
    const thirdQuestionId = await insertQuestion(chain.courseId);
    const otherQuestionId = await insertQuestion(chain.courseId);
    const otherQuestionVersionId = await insertQuestionVersion(otherQuestionId);

    await expect(
      insertTodaySessionItem({
        todaySessionId: chain.todaySessionId,
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: thirdQuestionId, // a Question not already in this session...
        questionVersionId: otherQuestionVersionId, // ...paired with a version of a DIFFERENT Question
        position: 1,
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("3. rejects an Attempt whose courseId does not match its Question's actual Course", async () => {
    const chain = await seedValidChain();
    const wrongCourseId = await insertCourse(chain.userId);

    await expect(
      insertAttempt({ ...chain, courseId: wrongCourseId }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("4. rejects an Attempt whose questionVersionId belongs to a DIFFERENT Question than its questionId", async () => {
    const chain = await seedValidChain();
    const otherQuestionId = await insertQuestion(chain.courseId);
    const otherQuestionVersionId = await insertQuestionVersion(otherQuestionId);

    await expect(
      insertAttempt({ ...chain, questionVersionId: otherQuestionVersionId }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("5. rejects an Attempt claiming a TodaySessionItem owned by ANOTHER user", async () => {
    const chain = await seedValidChain();
    const otherUserId = await insertUser();

    await expect(
      insertAttempt({
        ...chain,
        userId: otherUserId, // different user than the item's owner
        todaySessionItemId: chain.todaySessionItemId,
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("5b. rejects an Attempt whose todaySessionId does NOT match the session its claimed todaySessionItemId actually belongs to (adversarial-review finding: this column/FK was missing entirely from the original schema draft)", async () => {
    const chain = await seedValidChain();
    const otherSessionId = await insertTodaySession(
      chain.userId,
      chain.courseId,
      "2026-02-20", // different date -> a genuinely different session
    );

    await expect(
      insertAttempt({
        ...chain,
        todaySessionItemId: chain.todaySessionItemId, // belongs to chain.todaySessionId...
        todaySessionId: otherSessionId, // ...but this claims a DIFFERENT session
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("6. rejects a duplicate TodaySession for the same (user, course, date)", async () => {
    const chain = await seedValidChain();

    await expect(
      insertTodaySession(chain.userId, chain.courseId, "2026-01-10"),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("7. rejects a duplicate Today item position within the same session", async () => {
    const chain = await seedValidChain();
    const secondQuestionId = await insertQuestion(chain.courseId);
    const secondQuestionVersionId = await insertQuestionVersion(secondQuestionId);

    await expect(
      insertTodaySessionItem({
        todaySessionId: chain.todaySessionId,
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: secondQuestionId,
        questionVersionId: secondQuestionVersionId,
        position: 0, // same position as seedValidChain's item
      }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("8. rejects a duplicate Question within the same Today session", async () => {
    const chain = await seedValidChain();
    const secondVersionOfSameQuestion = await insertQuestionVersion(
      chain.questionId,
      2,
    );

    await expect(
      insertTodaySessionItem({
        todaySessionId: chain.todaySessionId,
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: chain.questionId, // same Question again
        questionVersionId: secondVersionOfSameQuestion,
        position: 1, // different position, so only the Question is duplicated
      }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("9. rejects an invalid evidence-counter sum (attempt_count != sum of the four quality counters)", async () => {
    const chain = await seedValidChain();

    await expect(
      db.query(
        `insert into user_question_progress
           (user_id, question_id, attempt_count, correct_count,
            meaningful_attempt_count, assisted_attempt_count,
            low_quality_attempt_count, invalid_for_mastery_attempt_count,
            engine_version)
         values ($1, $2, 5, 2, 3, 0, 0, 0, 'test-engine-v1')`, // 5 != 3+0+0+0
        [chain.userId, chain.questionId],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("10a. destructive parent deletion (a Question with historical evidence) is rejected, not silently cascaded", async () => {
    const chain = await seedValidChain();
    await insertAttempt(chain);

    // Postgres phrases a RESTRICT-triggered rejection slightly differently
    // ("violates RESTRICT setting of foreign key constraint ...") than a
    // plain FK-insert violation ("violates foreign key constraint ...") —
    // this regex matches either, since both are the DB refusing to let
    // historical evidence be silently destroyed.
    await expect(
      db.query("delete from questions where id = $1", [chain.questionId]),
    ).rejects.toThrow(/foreign key constraint/);
  });

  it("10b. deleting a TodaySessionItem an Attempt references only nulls the pointer — it never erases the Attempt or corrupts its ownership (the composite ON DELETE SET NULL(column) fix)", async () => {
    const chain = await seedValidChain();
    const attemptId = await insertAttempt({
      ...chain,
      todaySessionItemId: chain.todaySessionItemId,
    });

    // Deleting the parent session cascades to the item, which in turn must
    // SET NULL only today_session_item_id on the Attempt — NOT delete the
    // Attempt, and NOT touch (let alone null out) its user_id. An
    // unqualified composite `ON DELETE SET NULL` (rather than the
    // column-scoped `SET NULL (today_session_item_id)` this migration
    // actually uses) would have nulled attempts.user_id too and failed
    // against its NOT NULL constraint — this test is the real-engine proof
    // that the fix works, not just a code-review claim.
    await db.query("delete from today_sessions where id = $1", [
      chain.todaySessionId,
    ]);

    const result = await db.query<{
      id: string;
      user_id: string;
      today_session_item_id: string | null;
      today_session_id: string | null;
    }>(
      "select id, user_id, today_session_item_id, today_session_id from attempts where id = $1",
      [attemptId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].user_id).toBe(chain.userId);
    expect(result.rows[0].today_session_item_id).toBeNull();
    expect(result.rows[0].today_session_id).toBeNull();
  });

  it("11. rejects questions.current_version_id pointing to a QuestionVersion of a DIFFERENT Question (Phase-2-red-team item B)", async () => {
    const chain = await seedValidChain();
    const otherQuestionId = await insertQuestion(chain.courseId);
    const otherQuestionVersionId = await insertQuestionVersion(otherQuestionId);

    await expect(
      db.query("update questions set current_version_id = $1 where id = $2", [
        otherQuestionVersionId,
        chain.questionId,
      ]),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("11b. accepts questions.current_version_id pointing to one of ITS OWN QuestionVersions", async () => {
    const chain = await seedValidChain();
    const secondVersion = await insertQuestionVersion(chain.questionId, 2);

    await expect(
      db.query("update questions set current_version_id = $1 where id = $2", [
        secondVersion,
        chain.questionId,
      ]),
    ).resolves.toBeDefined();
  });

  it("12. rejects a TodaySessionItem whose Question belongs to a DIFFERENT Course than the item's own claimed course_id (Phase-2-red-team item H)", async () => {
    const chain = await seedValidChain();
    const otherCourseId = await insertCourse(chain.userId);
    const questionInOtherCourse = await insertQuestion(otherCourseId);
    const versionInOtherCourse = await insertQuestionVersion(questionInOtherCourse);

    await expect(
      db.query(
        `insert into today_session_items
           (id, today_session_id, user_id, course_id, position, question_id,
            question_version_id, action_type, tier)
         values ($1, $2, $3, $4, 1, $5, $6, 'REVIEW_DUE', 'DUE_REVIEW')`,
        [
          randomUUID(),
          chain.todaySessionId,
          chain.userId,
          chain.courseId, // claims the SESSION's real course_id...
          questionInOtherCourse, // ...but the Question actually belongs to a DIFFERENT course
          versionInOtherCourse,
        ],
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("13. rejects a TodaySessionItem whose claimed course_id does NOT match its parent TodaySession's actual course_id (Phase-2-red-team item H)", async () => {
    const chain = await seedValidChain();
    const otherCourseId = await insertCourse(chain.userId);
    // A Question that genuinely belongs to otherCourseId, so the
    // (question_id, course_id) FK alone would not catch this — only the
    // (today_session_id, user_id, course_id) FK to today_sessions can.
    const questionInOtherCourse = await insertQuestion(otherCourseId);
    const versionInOtherCourse = await insertQuestionVersion(questionInOtherCourse);

    await expect(
      db.query(
        `insert into today_session_items
           (id, today_session_id, user_id, course_id, position, question_id,
            question_version_id, action_type, tier)
         values ($1, $2, $3, $4, 1, $5, $6, 'REVIEW_DUE', 'DUE_REVIEW')`,
        [
          randomUUID(),
          chain.todaySessionId, // this session's REAL course is chain.courseId...
          chain.userId,
          otherCourseId, // ...but this item claims a DIFFERENT course
          questionInOtherCourse,
          versionInOtherCourse,
        ],
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("14. rejects an Attempt with today_session_item_id set but today_session_id left null (MATCH FULL partial-null fix, Phase-2-red-team item N)", async () => {
    const chain = await seedValidChain();

    await expect(
      insertAttempt({
        ...chain,
        todaySessionItemId: chain.todaySessionItemId,
        todaySessionId: null, // partial null — the exact gap MATCH SIMPLE left open
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("14b. rejects an Attempt with today_session_id set but today_session_item_id left null (the other partial-null direction)", async () => {
    const chain = await seedValidChain();

    await expect(
      insertAttempt({
        ...chain,
        todaySessionItemId: null,
        todaySessionId: chain.todaySessionId, // partial null the other way
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("15. rejects a UserQuestionProgress row with a negative evidence-quality counter even when the sum still balances (Phase-2-red-team item M/V)", async () => {
    const chain = await seedValidChain();

    // meaningful=-1, assisted=4, low=0, invalid=0 sums to 3, which the
    // sum-equality CHECK alone would happily accept against attempt_count=3
    // — only the newly-added per-column >= 0 checks catch this.
    await expect(
      db.query(
        `insert into user_question_progress
           (user_id, question_id, attempt_count, correct_count,
            meaningful_attempt_count, assisted_attempt_count,
            low_quality_attempt_count, invalid_for_mastery_attempt_count,
            engine_version)
         values ($1, $2, 3, 2, -1, 4, 0, 0, 'test-engine-v1')`,
        [chain.userId, chain.questionId],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("16. permits two different users to reuse the same submission_id (uniqueness is scoped to (user_id, submission_id), not global)", async () => {
    const chain = await seedValidChain();
    const otherUserId = await insertUser();
    const otherCourseId = await insertCourse(otherUserId);
    const otherQuestionId = await insertQuestion(otherCourseId);
    const otherQuestionVersionId = await insertQuestionVersion(otherQuestionId);
    const sharedSubmissionId = "shared-submission-id";

    await insertAttempt({ ...chain, submissionId: sharedSubmissionId });

    await expect(
      insertAttempt({
        userId: otherUserId,
        courseId: otherCourseId,
        questionId: otherQuestionId,
        questionVersionId: otherQuestionVersionId,
        submissionId: sharedSubmissionId,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("17. permits two different Courses to each have a TodaySession for the same user on the same date", async () => {
    const chain = await seedValidChain();
    const otherCourseId = await insertCourse(chain.userId);

    await expect(
      insertTodaySession(chain.userId, otherCourseId, "2026-01-10"),
    ).resolves.toBeTypeOf("string");
  });

  it("18. permits two different users to each have a TodaySession for the same Course on the same date", async () => {
    const chain = await seedValidChain();
    const otherUserId = await insertUser();

    await expect(
      insertTodaySession(otherUserId, chain.courseId, "2026-01-10"),
    ).resolves.toBeTypeOf("string");
  });

  it("19. canonical replay query (answered_at ASC, created_at ASC, id ASC) returns true chronological order regardless of insertion order, and DB-acceptance-order for equal answered_at (ADR-012 §4)", async () => {
    const chain = await seedValidChain();

    // Inserted out of order (3, 1, 2 by answeredAt) — the query's ORDER BY
    // must still recover true chronological order, exactly as
    // rebuild.ts's sortReplayRecords does in application code, but here
    // proven against the real SQL index this migration ships.
    const answeredAtThird = new Date("2026-01-03T00:00:00Z");
    const answeredAtFirst = new Date("2026-01-01T00:00:00Z");
    const answeredAtSecondA = new Date("2026-01-02T00:00:00Z");
    const answeredAtSecondB = new Date("2026-01-02T00:00:00Z"); // exact tie with A

    async function insertAttemptAt(answeredAt: Date, submissionId: string) {
      const id = randomUUID();
      await db.query(
        `insert into attempts
           (id, submission_id, user_id, course_id, question_id, question_version_id,
            answered_at, is_correct, attempt_number_for_presented_item, engine_version)
         values ($1, $2, $3, $4, $5, $6, $7, true, 1, 'test-engine-v1')`,
        [
          id,
          submissionId,
          chain.userId,
          chain.courseId,
          chain.questionId,
          chain.questionVersionId,
          answeredAt.toISOString(),
        ],
      );
      return id;
    }

    const thirdId = await insertAttemptAt(answeredAtThird, "sub-third");
    const firstId = await insertAttemptAt(answeredAtFirst, "sub-first");
    // secondA is inserted (and therefore DB-accepted) BEFORE secondB, so for
    // their exactly-equal answered_at, created_at must break the tie in
    // secondA's favor.
    const secondAId = await insertAttemptAt(answeredAtSecondA, "sub-second-a");
    const secondBId = await insertAttemptAt(answeredAtSecondB, "sub-second-b");

    const result = await db.query<{ id: string }>(
      `select id from attempts
         where user_id = $1 and question_id = $2
         order by answered_at asc, created_at asc, id asc`,
      [chain.userId, chain.questionId],
    );

    expect(result.rows.map((row) => row.id)).toEqual([
      firstId,
      secondAId,
      secondBId,
      thirdId,
    ]);
  });

  it("20. scheduler_state JSONB and typed scheduler columns round-trip exactly through UserQuestionProgress", async () => {
    const chain = await seedValidChain();
    const schedulerState = {
      implementation: "ts-fsrs",
      schemaVersion: 1,
      state: { due: "2026-02-01T00:00:00.000Z", stability: 3.5, reps: 2 },
    };

    await db.query(
      `insert into user_question_progress
         (user_id, question_id, attempt_count, correct_count,
          meaningful_attempt_count, assisted_attempt_count,
          low_quality_attempt_count, invalid_for_mastery_attempt_count,
          memory_stability, memory_difficulty, scheduler_review_count,
          scheduler_lapse_count, scheduler_implementation,
          scheduler_schema_version, scheduler_state, engine_version)
       values ($1, $2, 1, 1, 1, 0, 0, 0, 3.5, 4.2, 2, 0, 'ts-fsrs', 1, $3, 'test-engine-v1')`,
      [chain.userId, chain.questionId, JSON.stringify(schedulerState)],
    );

    const result = await db.query<{
      memory_stability: string;
      scheduler_state: unknown;
    }>(
      "select memory_stability, scheduler_state from user_question_progress where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );

    expect(Number(result.rows[0].memory_stability)).toBe(3.5);
    expect(result.rows[0].scheduler_state).toEqual(schedulerState);
  });

  it("accepts a representative fully-valid row chain, including UserQuestionProgress", async () => {
    const chain = await seedValidChain();

    await expect(
      insertAttempt({
        ...chain,
        todaySessionItemId: chain.todaySessionItemId,
      }),
    ).resolves.toBeTypeOf("string");

    await expect(insertValidProgress(chain.userId, chain.questionId)).resolves.toBeUndefined();

    const progress = await db.query(
      "select * from user_question_progress where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(progress.rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // course_memberships / courses.join_policy — ADR-015
  // -------------------------------------------------------------------------

  it("21. new courses default to AUTHORIZED_ONLY join_policy", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);

    const result = await db.query<{ join_policy: string }>(
      "select join_policy from courses where id = $1",
      [courseId],
    );
    expect(result.rows[0].join_policy).toBe("AUTHORIZED_ONLY");
  });

  it("22. rejects an invalid courses.join_policy value", async () => {
    const userId = await insertUser();
    const id = randomUUID();

    await expect(
      db.query(
        "insert into courses (id, owner_user_id, title, join_policy) values ($1, $2, 'Test Course', $3)",
        [id, userId, "SOMETHING_ELSE"],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("23. rejects an invalid course_memberships.role value", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);

    await expect(
      insertCourseMembership({ userId, courseId, role: "MANAGER" }),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("24. rejects a duplicate (user_id, course_id) membership", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);
    await insertCourseMembership({ userId, courseId });

    await expect(
      insertCourseMembership({ userId, courseId }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("25. rejects a membership referencing a nonexistent user", async () => {
    const ownerId = await insertUser();
    const courseId = await insertCourse(ownerId);

    await expect(
      insertCourseMembership({ userId: randomUUID(), courseId }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("26. rejects a membership referencing a nonexistent course", async () => {
    const userId = await insertUser();

    await expect(
      insertCourseMembership({ userId, courseId: randomUUID() }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("27. archivedAt and revokedAt are independent, nullable, and round-trip", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);
    const archivedAt = new Date("2026-02-01T00:00:00Z").toISOString();
    const id = await insertCourseMembership({
      userId,
      courseId,
      archivedAt,
      revokedAt: null,
    });

    const result = await db.query<{ revoked_at: string | null; archived_at: string | null }>(
      "select revoked_at, archived_at from course_memberships where id = $1",
      [id],
    );
    expect(result.rows[0].revoked_at).toBeNull();
    expect(result.rows[0].archived_at).not.toBeNull();
  });

  it("28. revoking a membership does not delete or alter learner history (attempts)", async () => {
    const chain = await seedValidChain();
    await insertCourseMembership({ userId: chain.userId, courseId: chain.courseId });
    await insertValidProgress(chain.userId, chain.questionId);
    const attemptId = await insertAttempt({ ...chain });

    await db.query(
      "update course_memberships set revoked_at = now() where user_id = $1 and course_id = $2",
      [chain.userId, chain.courseId],
    );

    const attemptResult = await db.query("select id from attempts where id = $1", [
      attemptId,
    ]);
    expect(attemptResult.rows).toHaveLength(1);
    const progressResult = await db.query(
      "select user_id from user_question_progress where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(progressResult.rows).toHaveLength(1);
  });

  it("29. course_memberships requires no institution table/column (ADR-006, ADR-015 §10)", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);

    await expect(
      insertCourseMembership({ userId, courseId, role: "OWNER" }),
    ).resolves.toBeTypeOf("string");

    const institutionTable = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name ilike '%institution%'`,
    );
    expect(institutionTable.rows).toHaveLength(0);

    const institutionColumn = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and column_name ilike '%institution%'`,
    );
    expect(institutionColumn.rows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // users.timezone — docs/OPEN_QUESTIONS.md #35, docs/DATABASE.md §26
  // -------------------------------------------------------------------------

  it("30. a newly-created user has a null timezone (no implied default)", async () => {
    const userId = await insertUser();

    const result = await db.query<{ timezone: string | null }>(
      "select timezone from users where id = $1",
      [userId],
    );
    expect(result.rows[0].timezone).toBeNull();
  });

  it("31. users.timezone accepts and round-trips an arbitrary text value (IANA validity is an application-layer concern, not a DB CHECK)", async () => {
    const userId = await insertUser();

    await db.query("update users set timezone = $2 where id = $1", [
      userId,
      "Asia/Jerusalem",
    ]);

    const result = await db.query<{ timezone: string | null }>(
      "select timezone from users where id = $1",
      [userId],
    );
    expect(result.rows[0].timezone).toBe("Asia/Jerusalem");
  });

  // -------------------------------------------------------------------------
  // daily_plans / daily_plan_items — ADR-016 §1/§19
  // -------------------------------------------------------------------------

  it("32. rejects a duplicate (user_id, planned_for_date) daily_plans row", async () => {
    const userId = await insertUser();
    await insertDailyPlan(userId, "2026-02-01");

    await expect(
      insertDailyPlan(userId, "2026-02-01"),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("33. permits two different users to each have a daily_plans row for the same date", async () => {
    const userA = await insertUser();
    const userB = await insertUser();

    await expect(insertDailyPlan(userA, "2026-02-01")).resolves.toBeTypeOf("string");
    await expect(insertDailyPlan(userB, "2026-02-01")).resolves.toBeTypeOf("string");
  });

  it("34. rejects a duplicate (daily_plan_id, question_id) daily_plan_items row — closes plan-membership double-counting by construction", async () => {
    const chain = await seedValidChain();
    const planId = await insertDailyPlan(chain.userId);
    await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      position: 0,
    });

    await expect(
      insertDailyPlanItem({
        dailyPlanId: planId,
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: chain.questionId,
        questionVersionId: chain.questionVersionId,
        position: 1,
      }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("35. rejects a duplicate (daily_plan_id, position) daily_plan_items row", async () => {
    const chain = await seedValidChain();
    const chain2Question = await insertQuestion(chain.courseId);
    const chain2Version = await insertQuestionVersion(chain2Question);
    const planId = await insertDailyPlan(chain.userId);
    await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      position: 0,
    });

    await expect(
      insertDailyPlanItem({
        dailyPlanId: planId,
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: chain2Question,
        questionVersionId: chain2Version,
        position: 0,
      }),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("36. rejects an invalid daily_plan_items.status value", async () => {
    const chain = await seedValidChain();
    const planId = await insertDailyPlan(chain.userId);
    const id = randomUUID();

    await expect(
      db.query(
        `insert into daily_plan_items
           (id, daily_plan_id, user_id, course_id, position, question_id,
            question_version_id, action_type, tier, status)
         values ($1, $2, $3, $4, 0, $5, $6, 'REVIEW_DUE', 'DUE_REVIEW', $7)`,
        [
          id,
          planId,
          chain.userId,
          chain.courseId,
          chain.questionId,
          chain.questionVersionId,
          "SOMETHING_ELSE",
        ],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("37. rejects a daily_plan_items row whose Question does not actually belong to its claimed course_id", async () => {
    const chain = await seedValidChain();
    const otherOwner = await insertUser();
    const otherCourseId = await insertCourse(otherOwner);
    const planId = await insertDailyPlan(chain.userId);

    await expect(
      insertDailyPlanItem({
        dailyPlanId: planId,
        userId: chain.userId,
        courseId: otherCourseId,
        questionId: chain.questionId,
        questionVersionId: chain.questionVersionId,
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("38. a daily_plan_items row independently carries its own course_id, unlike today_session_items (ADR-016 §1)", async () => {
    const chain = await seedValidChain();
    const secondCourseId = await insertCourse(chain.userId);
    const secondQuestionId = await insertQuestion(secondCourseId);
    const secondVersionId = await insertQuestionVersion(secondQuestionId);
    const planId = await insertDailyPlan(chain.userId);

    await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      position: 0,
    });
    await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: secondCourseId,
      questionId: secondQuestionId,
      questionVersionId: secondVersionId,
      position: 1,
    });

    const result = await db.query<{ course_id: string }>(
      "select distinct course_id from daily_plan_items where daily_plan_id = $1",
      [planId],
    );
    expect(result.rows.map((r) => r.course_id).sort()).toEqual(
      [chain.courseId, secondCourseId].sort(),
    );
  });

  it("39. resolvedAt/completedAt are independent and round-trip (completed sets both, skipped sets only resolvedAt)", async () => {
    const chain = await seedValidChain();
    const planId = await insertDailyPlan(chain.userId);
    const completedItemId = await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      position: 0,
    });
    const secondQuestionId = await insertQuestion(chain.courseId);
    const secondVersionId = await insertQuestionVersion(secondQuestionId);
    const skippedItemId = await insertDailyPlanItem({
      dailyPlanId: planId,
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: secondQuestionId,
      questionVersionId: secondVersionId,
      position: 1,
    });

    await db.query(
      "update daily_plan_items set status = 'completed', resolved_at = now(), completed_at = now() where id = $1",
      [completedItemId],
    );
    await db.query(
      "update daily_plan_items set status = 'skipped', resolved_at = now() where id = $1",
      [skippedItemId],
    );

    const result = await db.query<{
      id: string;
      resolved_at: string | null;
      completed_at: string | null;
    }>(
      "select id, resolved_at, completed_at from daily_plan_items where daily_plan_id = $1",
      [planId],
    );
    const completedRow = result.rows.find((r) => r.id === completedItemId);
    const skippedRow = result.rows.find((r) => r.id === skippedItemId);
    expect(completedRow?.resolved_at).not.toBeNull();
    expect(completedRow?.completed_at).not.toBeNull();
    expect(skippedRow?.resolved_at).not.toBeNull();
    expect(skippedRow?.completed_at).toBeNull();
  });

  it("40. daily_plans/daily_plan_items are purely additive: today_sessions/today_session_items remain fully intact and usable", async () => {
    // seedValidChain() already exercises the full existing TodaySession
    // path (session + item) — this test only needs to confirm that path
    // still works unmodified after the daily_plans/daily_plan_items
    // migration, not create a second session for the same
    // (user_id, course_id, planned_for_date) key.
    const chain = await seedValidChain();

    const todaySessionResult = await db.query(
      "select id from today_sessions where id = $1",
      [chain.todaySessionId],
    );
    expect(todaySessionResult.rows).toHaveLength(1);
    const todaySessionItemResult = await db.query(
      "select id from today_session_items where id = $1",
      [chain.todaySessionItemId],
    );
    expect(todaySessionItemResult.rows).toHaveLength(1);
  });

  it("RLS is enabled (not just declared) on every V1 table", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace
          and relkind = 'r'
        order by relname`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(9);
    for (const row of result.rows) {
      expect(row.relrowsecurity, `${row.relname} should have RLS enabled`).toBe(
        true,
      );
    }
  });
});
