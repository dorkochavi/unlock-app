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
