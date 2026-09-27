/**
 * PostgreSQL implementation of `AnswerFeedbackContentRepository`
 * (`src/application/learning/ports.ts`) — UX-03-QA1 Finding 2/3. The
 * POST-SUBMIT-ONLY counterpart to `PostgresLearnerQuestionContentRepository`:
 * this class selects `correct_answer, explanation` ON PURPOSE (that
 * repository's own doc comment names these as the two columns it must never
 * select). Callers must only invoke this after a real `submitAnswer`/
 * `submitPracticeAnswer` `ACCEPTED` result for the same `questionVersionId` —
 * see the port's own doc comment.
 */
import type {
  AnswerFeedbackContent,
  AnswerFeedbackContentRepository,
} from "../../application/learning/ports";
import { readCorrectOptionIds } from "./question-answer-definition-mapper";
import { readNullableString } from "./row-validation";
import type { SqlExecutor } from "./sql-executor";

const TABLE = "question_versions";

export class PostgresAnswerFeedbackContentRepository
  implements AnswerFeedbackContentRepository
{
  constructor(private readonly db: SqlExecutor) {}

  async findByVersionId(questionVersionId: string): Promise<AnswerFeedbackContent> {
    const result = await this.db.query(
      "select correct_answer, explanation from question_versions where id = $1",
      [questionVersionId],
    );
    if (result.rows.length !== 1) {
      // Callers only ever reach this after submitAnswer already resolved the
      // exact same questionVersionId against a real question_versions row
      // (via AnswerCorrectnessChecker/QuestionVersionRepository) — reaching
      // here means a real bug, surfaced loudly rather than treated as "no
      // feedback."
      throw new Error(
        `PostgresAnswerFeedbackContentRepository.findByVersionId: no question_versions row found for id=${questionVersionId}`,
      );
    }
    const row = result.rows[0] as Record<string, unknown>;
    return {
      correctOptionIds: readCorrectOptionIds(row.correct_answer),
      explanation: readNullableString(row, TABLE, "explanation"),
    };
  }
}
