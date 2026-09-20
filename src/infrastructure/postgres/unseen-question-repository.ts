/**
 * PostgreSQL implementation of `UnseenQuestionRepository`
 * (`src/application/dailyPlan/ports.ts`) — ADR-017 (Starter / New-Material
 * Exposure V1).
 *
 * SECURITY/CORRECTNESS-SENSITIVE, stated explicitly: the SQL text below is
 * the actual enforcement point for "unseen" (ADR-017 §1 — no prior real
 * Attempt for that Question, checked via `NOT EXISTS` against `attempts`,
 * never inferred from `user_question_progress` row absence) and for "has a
 * resolvable current QuestionVersion" (`current_version_id is not null`).
 * The query also resolves `question_version_id` directly (a plain join on
 * `questions.current_version_id`) rather than requiring a second per-question
 * lookup — avoiding the N+1 pattern the normal candidate path already
 * avoids for `UserQuestionProgress`. Selects no grading-only field.
 *
 * Deterministic order (`created_at asc, id asc` — ADR-017 §4), `limit`
 * applied per Course; `generate-daily-plan-for-resolved-inputs.ts` merges
 * and re-sorts each Course's own result set to get a single global
 * deterministic top-N across every eligible Course.
 */
import type {
  UnseenQuestionCandidate,
  UnseenQuestionRepository,
} from "../../application/dailyPlan/ports";
import { readDate, readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "questions";

export class PostgresUnseenQuestionRepository implements UnseenQuestionRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async findUnseenQuestions(
    userId: string,
    courseId: string,
    limit: number,
  ): Promise<UnseenQuestionCandidate[]> {
    const result = await this.db.query(
      `select q.id as question_id, q.course_id, q.current_version_id as question_version_id,
              q.created_at
         from questions q
        where q.course_id = $1
          and q.current_version_id is not null
          and not exists (
            select 1 from attempts a
             where a.user_id = $2 and a.question_id = q.id
          )
        order by q.created_at asc, q.id asc
        limit $3`,
      [courseId, userId, limit],
    );
    return result.rows.map((row) => ({
      questionId: readString(row, TABLE, "question_id"),
      courseId: readString(row, TABLE, "course_id"),
      questionVersionId: readString(row, TABLE, "question_version_id"),
      createdAt: readDate(row, TABLE, "created_at"),
    }));
  }
}
