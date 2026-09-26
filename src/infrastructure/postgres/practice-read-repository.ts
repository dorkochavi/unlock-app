/**
 * PostgreSQL implementation of `PracticeReadRepository`
 * (`src/application/practice/ports.ts`) — Run UX-02 P2, ADR-020.
 *
 * The SQL here enforces scope: only servable Questions
 * (`current_version_id is not null`) of the given Course, optionally of the
 * given current Topic (`questions.topic_id`, ADR-018). Selects no grading
 * field. Session exclusion reads `attempts.learning_session_id`, which for
 * Today Attempts is the DailyPlan id and for Practice Attempts is the same id
 * (ADR-020) — so one query covers both.
 */
import type { PracticeReadRepository, PracticeScopeQuestion } from "../../application/practice/ports";
import { readBoolean, readDate, readNullableString, readString } from "./row-validation";
import type { SqlExecutor } from "./sql-executor";

const TABLE = "practice_scope";

export class PostgresPracticeReadRepository implements PracticeReadRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listScopeQuestions(
    userId: string,
    courseId: string,
    topicId: string | null,
  ): Promise<PracticeScopeQuestion[]> {
    const result = await this.db.query(
      `select q.id as question_id, q.current_version_id as question_version_id,
              q.created_at, q.topic_id,
              exists (
                select 1 from attempts a where a.user_id = $1 and a.question_id = q.id
              ) as attempted
         from questions q
        where q.course_id = $2
          and q.current_version_id is not null
          and ($3::uuid is null or q.topic_id = $3::uuid)
        order by q.created_at asc, q.id asc`,
      [userId, courseId, topicId],
    );
    return result.rows.map((row) => ({
      questionId: readString(row, TABLE, "question_id"),
      questionVersionId: readString(row, TABLE, "question_version_id"),
      createdAt: readDate(row, TABLE, "created_at"),
      topicId: readNullableString(row, TABLE, "topic_id"),
      attempted: readBoolean(row, TABLE, "attempted"),
    }));
  }

  async findScopeQuestion(courseId: string, questionId: string) {
    const result = await this.db.query(
      `select q.id as question_id, q.current_version_id as question_version_id, q.topic_id
         from questions q
        where q.id = $1 and q.course_id = $2 and q.current_version_id is not null`,
      [questionId, courseId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      questionId: readString(row, TABLE, "question_id"),
      questionVersionId: readString(row, TABLE, "question_version_id"),
      topicId: readNullableString(row, TABLE, "topic_id"),
    };
  }

  async listQuestionIdsAnsweredInSession(
    userId: string,
    learningSessionId: string,
  ): Promise<string[]> {
    const result = await this.db.query(
      `select distinct question_id from attempts
        where user_id = $1 and learning_session_id = $2`,
      [userId, learningSessionId],
    );
    return result.rows.map((row) => readString(row, TABLE, "question_id"));
  }
}
