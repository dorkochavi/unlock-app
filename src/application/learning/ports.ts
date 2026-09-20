/**
 * Persistence ports for the learning application layer.
 *
 * These are small, explicit interfaces — not a generic `Repository<T>`
 * abstraction (`docs/ARCHITECTURE.md` §20/§29: keep the repository pattern
 * simple unless complexity requires more). No Postgres/Supabase types leak
 * into any of these signatures; a real adapter implements them elsewhere
 * (not part of this session — see `docs/PERSISTENCE_SCHEMA_V1.md`).
 *
 * `docs/DECISIONS/010-answer-submission-transaction-model.md`'s required
 * discipline applies here directly: `UserQuestionProgressRepository.getForUpdate`/
 * `upsert` must only ever be called from inside a transaction that has
 * already called `acquireLearnerQuestionLock` for the same
 * `(userId, questionId)` — this file cannot enforce that by itself; it is
 * an orchestration contract the application services below must follow
 * (see submit-answer.ts).
 */

import type { AttemptReplayRecord } from "../../domain/learning/rebuild";
import type { AnswerOption, QuestionType } from "../../domain/learning/answer";
import type {
  NextBestActionReason,
  NextBestActionType,
} from "../../domain/learning/next-best-action";
import type { NextBestActionPriorityTier } from "../../domain/learning/next-best-action-ranking";
// Reused directly from the domain layer — never redefined here, so the
// application layer's persistence contract cannot silently drift from the
// domain's own Attempt/UserQuestionProgress shapes.
import type {
  Attempt,
  SelectedAnswer,
  UserQuestionProgress,
} from "../../domain/learning/types";

export type { Attempt };
export type { AttemptReplayRecord };

export interface AttemptRepository {
  /**
   * Idempotent insert against the `UNIQUE (user_id, submission_id)`
   * constraint (ADR-010). `wasNew: false` means an Attempt with this
   * `(userId, submissionId)` already existed — the returned `attempt` is
   * that pre-existing row, NOT the one passed in. This port does not
   * validate whether the pre-existing Attempt matches the caller's
   * expected command — that is an orchestration decision, made by
   * submitAnswer using the caller-supplied command, not a storage concern.
   */
  insertIfNotExists(
    attempt: Attempt,
  ): Promise<{ attempt: Attempt; wasNew: boolean }>;

  /**
   * Cheap existing-Attempt lookup by the idempotency key, used by
   * `submitAnswer` to short-circuit a genuine retry BEFORE any
   * server-derived computation (`isCorrect`, `suspiciousTiming`,
   * QuestionVersion/TodaySessionItem consistency checks) or the insert
   * attempt itself. Does not itself close any race — a concurrent
   * duplicate submission can still race this read (both see `null`), in
   * which case both fall through to the full `insertIfNotExists` path,
   * whose `UNIQUE (user_id, submission_id)` constraint remains the actual
   * safety net, exactly as before this method existed. This method only
   * ever makes the COMMON, non-concurrent, sequential-retry case
   * (network timeout then retry, double-click after the first request
   * already finished, etc.) cheaper — it never weakens the uniqueness
   * boundary.
   */
  findByUserAndSubmissionId(
    userId: string,
    submissionId: string,
  ): Promise<Attempt | null>;

  /**
   * All Attempts ever accepted for one `(userId, questionId)` pair, each
   * paired with its `createdAt` (DB acceptance time) — the smallest
   * explicit port needed for `rebuildUserQuestionProgress`
   * (`src/domain/learning/rebuild.ts`) to have a truthful ordering
   * tie-break. Order is NOT guaranteed by this method — callers must sort
   * via `sortReplayRecords`/`rebuildUserQuestionProgress` itself, which
   * always sorts defensively.
   */
  listForReplay(
    userId: string,
    questionId: string,
  ): Promise<AttemptReplayRecord[]>;
}

export interface UserQuestionProgressRepository {
  /**
   * MUST only be called after `acquireLearnerQuestionLock(userId,
   * questionId)` in the same transaction (ADR-010's required discipline).
   * Returns null when no progress row exists yet for this pair — this is
   * the ONLY way `previousProgress: null` should ever reach
   * `applyAttemptToProgress`; no placeholder/zero-state row is ever
   * created (ADR-010 rejected that approach explicitly).
   */
  getForUpdate(
    userId: string,
    questionId: string,
  ): Promise<UserQuestionProgress | null>;

  upsert(progress: UserQuestionProgress): Promise<void>;

  /**
   * Lists current progress for every Question a learner has progress for
   * within one Course. Used by `getOrCreateTodaySession` to assemble
   * candidates. `courseId` is required (not nullable) because UNLOCK V1
   * Today is course-scoped (`docs/DECISIONS/011-today-is-course-scoped-v1.md`)
   * — there is no "no Course scoping" case to represent.
   */
  listForUser(
    userId: string,
    courseId: string,
  ): Promise<UserQuestionProgress[]>;
}

/**
 * Deliberately its own small port, not bundled into a general Question
 * read repository — its real Postgres implementation
 * (`PostgresAnswerCorrectnessChecker`) runs its own narrow read query
 * directly rather than broadening `QuestionVersionRepository`'s contract
 * (see ADR-014). The correctness computation itself is a pure domain
 * function (`evaluateAnswerCorrectness`, `src/domain/learning/answer.ts`);
 * this port's job is only to load and validate the persisted
 * `QuestionAnswerDefinition` by exact `questionVersionId` and delegate.
 *
 * `isCorrect` throws `InvalidSelectedAnswerError`
 * (`src/domain/learning/answer.ts`) — never merely returns `false` — for a
 * structurally malformed `selectedAnswer` (wrong shape for the question's
 * type, unknown option id, duplicate ids, or `null`/empty). Callers (see
 * `submit-answer.ts`) must catch that specific error and map it to a
 * request-validation result, not to "the answer was wrong."
 */
export interface AnswerCorrectnessChecker {
  isCorrect(
    questionVersionId: string,
    selectedAnswer: SelectedAnswer,
  ): Promise<boolean>;
}

/**
 * Learner-facing content for one QuestionVersion — this slice's dedicated
 * SAFE read shape (`docs/DEV_STATUS.md` "learner-facing question content").
 * Deliberately excludes `correctOptionIds`, `explanation`, or any other
 * grading-only/internal field that exists on the same `question_versions`
 * row `QuestionAnswerDefinition` (above) reads for grading — there is no
 * field on this type a caller could accidentally forward to a learner that
 * would leak the correct answer, by construction, not by convention.
 *
 * `options` reuses `AnswerOption` directly (id/content only, same as the
 * grading shape) since option identity/content is not itself secret; only
 * `correctOptionIds` is.
 */
export interface LearnerQuestionContent {
  questionVersionId: string;
  questionType: QuestionType;
  prompt: string;
  options: AnswerOption[];
}

/**
 * Dedicated learner-facing read port — SEPARATE from
 * `AnswerCorrectnessChecker`/`QuestionVersionRepository` above, which exist
 * to serve grading, not learner display. A real implementation's SQL text
 * must select only the columns `LearnerQuestionContent` needs and must
 * NEVER select `correct_answer` or `explanation` — this is a
 * security-sensitive boundary, not an ordinary repository convenience (see
 * `PostgresLearnerQuestionContentRepository`'s own doc comment and its
 * dedicated regression test asserting the literal SQL text).
 *
 * Resolves EXACT persisted QuestionVersion ids, never "the Question's
 * current version" — matching `AnswerCorrectnessChecker.isCorrect`'s own
 * requirement that historical/frozen content is never silently swapped for
 * a newer version.
 */
export interface LearnerQuestionContentRepository {
  findManyByVersionIds(
    questionVersionIds: readonly string[],
  ): Promise<LearnerQuestionContent[]>;
}

export interface QuestionVersionRepository {
  /** The Question's current version at the moment of the call. */
  getCurrentVersion(
    questionId: string,
  ): Promise<{ questionId: string; versionId: string } | null>;

  /**
   * Resolves the Question and Course a given QuestionVersion actually
   * belongs to. `docs/PERSISTENCE_SCHEMA_V1.md`'s composite FKs enforce
   * this invariant at the database level in a real implementation, but
   * `submitAnswer` validates it explicitly too (see submit-answer.ts) —
   * an in-memory/test double, and any pre-insert validation before the
   * INSERT itself runs, cannot rely on a DB constraint firing. Returns
   * null when the QuestionVersion does not exist at all.
   */
  resolveVersionContext(
    questionVersionId: string,
  ): Promise<{ questionId: string; courseId: string } | null>;
}

export interface TodaySessionItem {
  id: string;
  todaySessionId: string;
  userId: string;
  position: number;
  questionId: string;
  questionVersionId: string;
  actionType: NextBestActionType;
  tier: NextBestActionPriorityTier;
  otherApplicableTypes: NextBestActionType[];
  reasons: NextBestActionReason[];
  status: "pending" | "completed" | "skipped";
  completedAt: Date | null;
}

export interface TodaySession {
  id: string;
  userId: string;
  courseId: string;
  plannedForDate: string;
  status: string;
  engineVersion: string;
  generatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  items: TodaySessionItem[];
}

/**
 * UNLOCK V1 Today is course-scoped
 * (`docs/DECISIONS/011-today-is-course-scoped-v1.md`) — matches
 * `today_sessions`'s `UNIQUE (user_id, course_id, planned_for_date)`.
 * Global cross-course Today is deferred beyond V1; this type does not
 * represent it (there was previously a `scope: "course" | "global"`
 * discriminated union here, representing that then-open question — removed
 * now that it's decided).
 */
export interface TodaySessionKey {
  userId: string;
  courseId: string;
  plannedForDate: string;
}

export interface TodaySessionRepository {
  findByKey(key: TodaySessionKey): Promise<TodaySession | null>;

  /**
   * Race-free by construction (`INSERT ... ON CONFLICT DO NOTHING
   * RETURNING` + fallback `SELECT`, per ADR-010) — returns the
   * newly-created session, or the existing one if another concurrent call
   * won the race for the same key. Never throws on a legitimate
   * concurrent-create race.
   */
  createIfNotExists(
    session: Omit<TodaySession, "items" | "id">,
    items: Array<Omit<TodaySessionItem, "id" | "todaySessionId">>,
  ): Promise<TodaySession>;

  findItemById(itemId: string): Promise<TodaySessionItem | null>;

  markItemCompleted(
    itemId: string,
    completedAt: Date,
    attemptId: string,
  ): Promise<void>;
}

/**
 * Minimal DailyPlanItem shape `submitAnswer` needs to authorize and resolve
 * a DailyPlan-attached Attempt (ADR-016) — deliberately NOT the fuller
 * `DailyPlanItem` from `application/dailyPlan/ports.ts` (position,
 * actionType, tier, reasons, ...). Matches this file's existing convention
 * of not cross-importing that module's types (see that file's own doc
 * comment for why the two modules deliberately do not share a
 * transaction/port dependency) — the real Postgres implementation
 * (`PostgresDailyPlanRepository`) already satisfies this shape structurally,
 * so no new infrastructure class is needed for it.
 */
export interface DailyPlanAnswerTarget {
  id: string;
  dailyPlanId: string;
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  status: "pending" | "completed" | "skipped";
}

export type ResolveDailyPlanAnswerItemResult =
  | { outcome: "RESOLVED" }
  /**
   * `item` here is intentionally narrower than the full `DailyPlanItem` —
   * only `status` is needed so a caller (e.g. `skipDailyPlanItem`) can
   * report WHICH resolution already happened, without this port depending
   * on `application/dailyPlan/ports.ts`'s fuller type.
   */
  | { outcome: "ALREADY_RESOLVED"; item: Pick<DailyPlanAnswerTarget, "status"> }
  | { outcome: "NOT_FOUND" };

export interface DailyPlanAnswerRepository {
  findItemById(itemId: string): Promise<DailyPlanAnswerTarget | null>;

  /**
   * Resolves a `pending` DailyPlanItem as COMPLETED. Same single-use
   * enforcement as `application/dailyPlan/ports.ts`'s `DailyPlanRepository
   * .markCompleted` (in fact the same real implementation backs both) —
   * `submitAnswer`'s own pending check (before grading, see submit-answer.ts)
   * is what actually prevents reaching this call for an already-resolved
   * item under normal operation; this repository-level guarantee is
   * defense-in-depth, not the primary enforcement point.
   */
  markCompleted(
    itemId: string,
    completedAt: Date,
  ): Promise<ResolveDailyPlanAnswerItemResult>;

  /**
   * Resolves a `pending` DailyPlanItem as SKIPPED (ADR-016, Night-Run
   * Slice 3) — same single-use enforcement, same real implementation
   * (`PostgresDailyPlanRepository.markSkipped`). Never creates an Attempt
   * and never touches `UserQuestionProgress` — this port has no way to,
   * since it only ever issues an `UPDATE daily_plan_items`
   * (`.claude/rules/learning-engine.md` "Item resolution").
   */
  markSkipped(
    itemId: string,
    skippedAt: Date,
  ): Promise<ResolveDailyPlanAnswerItemResult>;
}

export interface TransactionalRepositories {
  /**
   * Postgres transaction-scoped advisory lock keyed by
   * `(userId, questionId)` (ADR-010). MUST be the first call made against
   * a `(userId, questionId)` pair in any transaction that will read-then-
   * write `UserQuestionProgress` for that pair.
   */
  acquireLearnerQuestionLock(userId: string, questionId: string): Promise<void>;
  attempts: AttemptRepository;
  progress: UserQuestionProgressRepository;
  answerCorrectness: AnswerCorrectnessChecker;
  questionVersions: QuestionVersionRepository;
  todaySessions: TodaySessionRepository;
  dailyPlanItems: DailyPlanAnswerRepository;
}

export interface UnitOfWork {
  /**
   * Runs `fn` inside one database transaction. Any thrown error rolls the
   * whole transaction back — nothing partial is ever committed (ADR-010's
   * transaction-boundary decision). Callers must not swallow an error
   * before this resolves; doing so would be exactly the "one step
   * succeeds, another silently fails" corruption `docs/ARCHITECTURE.md`
   * §21 prohibits.
   */
  runInTransaction<T>(
    fn: (repos: TransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}
