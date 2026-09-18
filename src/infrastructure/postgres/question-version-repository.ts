/**
 * PostgreSQL implementation of `QuestionVersionRepository`
 * (`src/application/learning/ports.ts`), backed by `questions` /
 * `question_versions`.
 */
import type { QuestionVersionRepository } from "../../application/learning/ports";
import { readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

export class PostgresQuestionVersionRepository
  implements QuestionVersionRepository
{
  constructor(private readonly db: TransactionExecutor) {}

  /**
   * Returns `null` both when the Question does not exist and when it
   * exists but has no `current_version_id` yet (the transient
   * pre-first-version state documented on that column in the migration) —
   * either way, the caller's contract is "no current version is available
   * right now," and the two cases are not meaningfully different to a
   * caller of this port.
   */
  async getCurrentVersion(
    questionId: string,
  ): Promise<{ questionId: string; versionId: string } | null> {
    const result = await this.db.query<{
      id: string;
      current_version_id: string | null;
    }>("select id, current_version_id from questions where id = $1", [
      questionId,
    ]);
    if (result.rows.length !== 1 || result.rows[0].current_version_id === null) {
      return null;
    }
    return {
      questionId: readString(result.rows[0], "questions", "id"),
      versionId: readString(result.rows[0], "questions", "current_version_id"),
    };
  }

  async resolveVersionContext(
    questionVersionId: string,
  ): Promise<{ questionId: string; courseId: string } | null> {
    const result = await this.db.query<{
      question_id: string;
      course_id: string;
    }>(
      `select qv.question_id, q.course_id
         from question_versions qv
         join questions q on q.id = qv.question_id
        where qv.id = $1`,
      [questionVersionId],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    return {
      questionId: readString(result.rows[0], "question_versions", "question_id"),
      courseId: readString(result.rows[0], "questions", "course_id"),
    };
  }
}
