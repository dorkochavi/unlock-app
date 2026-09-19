/**
 * PostgreSQL implementation of `LearnerQuestionContentRepository`
 * (`src/application/learning/ports.ts`) — the dedicated, narrowly-projected
 * learner-facing read path for `question_versions` content.
 *
 * SECURITY-SENSITIVE, stated explicitly: the SQL text below is the actual
 * enforcement point. It names `id, question_type, prompt, answer_options`
 * and nothing else — `correct_answer` and `explanation` are never part of
 * the column list, so neither value is ever fetched from the database in
 * the first place. There is no "select the whole row, strip fields in
 * application code" step anywhere in this file for a future edit to
 * accidentally remove; a field this query does not name cannot reach the
 * mapper, the domain shape, or the HTTP response.
 *
 * Deliberately takes a plain `SqlExecutor`, not a `TransactionExecutor`: a
 * batched multi-id read has no write/atomicity requirement, matching
 * `PostgresUserRepository`/`PostgresCourseMembershipRepository`'s existing
 * "plain read, no transaction" convention
 * (`infrastructure/dailyPlan/composition-root.ts`'s own doc comment).
 *
 * Resolves by the EXACT `id`s given (`= any($1)`) — never via
 * `questions.current_version_id` — so a later edit to a Question's current
 * version can never change what an already-persisted DailyPlanItem shows a
 * learner, matching `PostgresAnswerCorrectnessChecker`'s own frozen-version
 * discipline.
 */
import type {
  LearnerQuestionContent,
  LearnerQuestionContentRepository,
} from "../../application/learning/ports";
import { mapLearnerQuestionContentRow } from "./learner-question-content-mapper";
import type { SqlExecutor } from "./sql-executor";

export class PostgresLearnerQuestionContentRepository
  implements LearnerQuestionContentRepository
{
  constructor(private readonly db: SqlExecutor) {}

  async findManyByVersionIds(
    questionVersionIds: readonly string[],
  ): Promise<LearnerQuestionContent[]> {
    if (questionVersionIds.length === 0) {
      return [];
    }
    const result = await this.db.query(
      "select id, question_type, prompt, answer_options from question_versions where id = any($1)",
      [questionVersionIds],
    );
    return result.rows.map(mapLearnerQuestionContentRow);
  }
}
