/**
 * PostgreSQL implementation of `UserQuestionProgressRepository`
 * (`src/application/learning/ports.ts`), backed by
 * `user_question_progress`.
 *
 * Every method here MUST only be called after
 * `TransactionalRepositories.acquireLearnerQuestionLock(userId, questionId)`
 * has already run in the same transaction (ADR-010's required discipline) —
 * this class cannot enforce that itself; see `postgres-unit-of-work.ts`.
 */
import type { UserQuestionProgressRepository } from "../../application/learning/ports";
import type { UserQuestionProgress } from "../../domain/learning/types";
import { mapProgressRow, progressUpsertParams } from "./progress-mapper";
import type { TransactionExecutor } from "./sql-executor";

const UPSERT_SQL = `
  insert into user_question_progress (
    user_id, question_id, attempt_count, correct_count, last_attempt_at,
    last_correct_at, last_incorrect_at, memory_stability, memory_difficulty,
    scheduled_review_at, last_review_at, scheduler_review_count,
    scheduler_lapse_count, scheduler_implementation, scheduler_schema_version,
    scheduler_state, retrieval_baseline_at,
    retrieval_baseline_learning_session_id, successful_spaced_retrievals,
    lapse_count, last_lapse_at, misconception_state, misconception_score,
    misconception_last_seen_at, timed_attempt_count,
    average_response_time_seconds, meaningful_attempt_count,
    assisted_attempt_count, low_quality_attempt_count,
    invalid_for_mastery_attempt_count, first_meaningful_evidence_at,
    last_meaningful_evidence_at, evidence_strength, mastery_category,
    engine_version, updated_at
  )
  values (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
    $31, $32, $33, $34, $35, $36
  )
  on conflict (user_id, question_id) do update set
    attempt_count = excluded.attempt_count,
    correct_count = excluded.correct_count,
    last_attempt_at = excluded.last_attempt_at,
    last_correct_at = excluded.last_correct_at,
    last_incorrect_at = excluded.last_incorrect_at,
    memory_stability = excluded.memory_stability,
    memory_difficulty = excluded.memory_difficulty,
    scheduled_review_at = excluded.scheduled_review_at,
    last_review_at = excluded.last_review_at,
    scheduler_review_count = excluded.scheduler_review_count,
    scheduler_lapse_count = excluded.scheduler_lapse_count,
    scheduler_implementation = excluded.scheduler_implementation,
    scheduler_schema_version = excluded.scheduler_schema_version,
    scheduler_state = excluded.scheduler_state,
    retrieval_baseline_at = excluded.retrieval_baseline_at,
    retrieval_baseline_learning_session_id = excluded.retrieval_baseline_learning_session_id,
    successful_spaced_retrievals = excluded.successful_spaced_retrievals,
    lapse_count = excluded.lapse_count,
    last_lapse_at = excluded.last_lapse_at,
    misconception_state = excluded.misconception_state,
    misconception_score = excluded.misconception_score,
    misconception_last_seen_at = excluded.misconception_last_seen_at,
    timed_attempt_count = excluded.timed_attempt_count,
    average_response_time_seconds = excluded.average_response_time_seconds,
    meaningful_attempt_count = excluded.meaningful_attempt_count,
    assisted_attempt_count = excluded.assisted_attempt_count,
    low_quality_attempt_count = excluded.low_quality_attempt_count,
    invalid_for_mastery_attempt_count = excluded.invalid_for_mastery_attempt_count,
    first_meaningful_evidence_at = excluded.first_meaningful_evidence_at,
    last_meaningful_evidence_at = excluded.last_meaningful_evidence_at,
    evidence_strength = excluded.evidence_strength,
    mastery_category = excluded.mastery_category,
    engine_version = excluded.engine_version,
    updated_at = excluded.updated_at
`;

export class PostgresUserQuestionProgressRepository
  implements UserQuestionProgressRepository
{
  constructor(private readonly db: TransactionExecutor) {}

  /**
   * `FOR UPDATE` here is defense-in-depth, not the primary concurrency
   * guard — the transaction-scoped advisory lock
   * (`acquireLearnerQuestionLock`) already excludes any other transaction
   * for this exact `(userId, questionId)` pair, including before any row
   * exists (ADR-010's "First-progress-row concurrency" section, which
   * explains exactly why `FOR UPDATE` ALONE would be insufficient for that
   * case). `FOR UPDATE` is harmless here precisely because the row this
   * transaction is about to lock is never contended by the time this runs.
   */
  async getForUpdate(
    userId: string,
    questionId: string,
  ): Promise<UserQuestionProgress | null> {
    const result = await this.db.query(
      "select * from user_question_progress where user_id = $1 and question_id = $2 for update",
      [userId, questionId],
    );
    return result.rows.length === 1 ? mapProgressRow(result.rows[0]) : null;
  }

  async upsert(progress: UserQuestionProgress): Promise<void> {
    await this.db.query(UPSERT_SQL, progressUpsertParams(progress));
  }

  /**
   * `docs/DECISIONS/011-today-is-course-scoped-v1.md`: Today (and
   * therefore this listing) is Course-scoped. `user_question_progress` has
   * no `course_id` column of its own (`courseId` is transitively
   * determined via `question_id -> questions.course_id` — see the table's
   * own comment in the migration) — this join is what makes the Course
   * filter possible; `questions_course_id_idx` is what keeps it efficient.
   */
  async listForUser(
    userId: string,
    courseId: string,
  ): Promise<UserQuestionProgress[]> {
    const result = await this.db.query(
      `select p.*
         from user_question_progress p
         join questions q on q.id = p.question_id
        where p.user_id = $1 and q.course_id = $2`,
      [userId, courseId],
    );
    return result.rows.map(mapProgressRow);
  }
}
