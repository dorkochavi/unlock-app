/**
 * PostgreSQL implementation of `AttemptRepository` (`src/application/
 * learning/ports.ts`), backed by the `attempts` table
 * (`supabase/migrations/20260917203000_initial_schema.sql`).
 */
import type { AttemptReplayRecord } from "../../domain/learning/rebuild";
import type { AttemptRepository } from "../../application/learning/ports";
import type { Attempt } from "../../domain/learning/types";
import { attemptInsertParams, mapAttemptRow, readCreatedAt } from "./attempt-mapper";
import type { TransactionExecutor } from "./sql-executor";

const INSERT_SQL = `
  insert into attempts (
    id, submission_id, user_id, course_id, question_id, question_version_id,
    learning_session_id,
    answered_at, is_correct, selected_answer, confidence_level,
    response_time_seconds, assistance_used, attempt_number_for_presented_item,
    suspicious_timing, answer_was_revealed_before_response, engine_version,
    daily_plan_id, daily_plan_item_id
  )
  values (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
    $18, $19
  )
  on conflict (user_id, submission_id) do nothing
  returning *
`;

export class PostgresAttemptRepository implements AttemptRepository {
  constructor(private readonly db: TransactionExecutor) {}

  /**
   * Uses the database's own `UNIQUE (user_id, submission_id)` constraint
   * via `INSERT ... ON CONFLICT DO NOTHING RETURNING` — NOT a
   * `SELECT`-then-`INSERT` pair, which would race under concurrent
   * duplicate submissions (ADR-010). When the conflict branch fires
   * (nothing returned), the existing row is fetched with a follow-up
   * `SELECT` — this second read cannot itself race a concurrent insert
   * into non-existence, because a row satisfying the conflict must already
   * be committed-or-in-this-transaction for the `ON CONFLICT` to have
   * fired at all.
   */
  async insertIfNotExists(
    attempt: Attempt,
  ): Promise<{ attempt: Attempt; wasNew: boolean }> {
    const inserted = await this.db.query(INSERT_SQL, attemptInsertParams(attempt));
    if (inserted.rows.length === 1) {
      return { attempt: mapAttemptRow(inserted.rows[0]), wasNew: true };
    }

    const existing = await this.db.query(
      "select * from attempts where user_id = $1 and submission_id = $2",
      [attempt.userId, attempt.submissionId],
    );
    if (existing.rows.length !== 1) {
      // The ON CONFLICT branch fired, so a matching row must exist — this
      // would only be reachable via a bug (e.g. the conflict target drifting
      // out of sync with the actual unique index), so it is surfaced loudly
      // rather than treated as "not found".
      throw new Error(
        `PostgresAttemptRepository.insertIfNotExists: INSERT reported a ` +
          `conflict for (user_id=${attempt.userId}, submission_id=` +
          `${attempt.submissionId}) but no matching row was found on the ` +
          `follow-up SELECT`,
      );
    }
    return { attempt: mapAttemptRow(existing.rows[0]), wasNew: false };
  }

  async findByUserAndSubmissionId(
    userId: string,
    submissionId: string,
  ): Promise<Attempt | null> {
    const result = await this.db.query(
      "select * from attempts where user_id = $1 and submission_id = $2",
      [userId, submissionId],
    );
    return result.rows.length === 1 ? mapAttemptRow(result.rows[0]) : null;
  }

  /**
   * Ordered by the canonical replay order (`answered_at ASC, created_at
   * ASC, id ASC`, ADR-012 §4) as a query-plan optimization only — this
   * matches `attempts_replay_idx` exactly, so Postgres can satisfy this via
   * a plain index scan instead of a separate sort step. Correctness does
   * NOT depend on this ORDER BY: `rebuildUserQuestionProgress`
   * (`rebuild.ts`) sorts defensively regardless of the order rows arrive
   * in, exactly per `AttemptRepository.listForReplay`'s own port contract.
   */
  async listForReplay(
    userId: string,
    questionId: string,
  ): Promise<AttemptReplayRecord[]> {
    const result = await this.db.query(
      `select * from attempts
         where user_id = $1 and question_id = $2
         order by answered_at asc, created_at asc, id asc`,
      [userId, questionId],
    );
    return result.rows.map((row) => ({
      attempt: mapAttemptRow(row),
      createdAt: readCreatedAt(row),
    }));
  }
}
