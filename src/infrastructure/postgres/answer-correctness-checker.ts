/**
 * PostgreSQL implementation of `AnswerCorrectnessChecker`
 * (`src/application/learning/ports.ts`) — ADR-014.
 *
 * Previously blocked pending a decided `answer_options`/`correct_answer`
 * shape (see ADR-014's Context section); now implemented against that
 * decision.
 *
 * Deliberately thin: this class only loads and validates a persisted
 * `QuestionAnswerDefinition`, then delegates the actual correctness
 * computation to the pure domain function `evaluateAnswerCorrectness`
 * (`src/domain/learning/answer.ts`). No correctness logic is duplicated
 * here or pushed into SQL.
 */
import {
  evaluateAnswerCorrectness,
  assertValidQuestionAnswerDefinition,
} from "../../domain/learning/answer";
import type { AnswerCorrectnessChecker } from "../../application/learning/ports";
import type { SelectedAnswer } from "../../domain/learning/types";
import { mapQuestionAnswerDefinitionRow } from "./question-answer-definition-mapper";
import type { TransactionExecutor } from "./sql-executor";

export class PostgresAnswerCorrectnessChecker implements AnswerCorrectnessChecker {
  constructor(private readonly db: TransactionExecutor) {}

  /**
   * Loads `question_versions` **by the exact `questionVersionId` given** —
   * never via `questions.current_version_id` (ADR-014 Decision §6/Phase 2
   * item K/L: correctness must depend only on the frozen QuestionVersion
   * an Attempt actually references, so a later edit to the Question's
   * CURRENT version can never change how an old Attempt is graded).
   *
   * Throws `InvalidQuestionAnswerDefinitionError` (via
   * `assertValidQuestionAnswerDefinition`) for a structurally malformed
   * PERSISTED definition — an infrastructure/data-corruption error,
   * deliberately NOT caught by `submit-answer.ts`'s specific error
   * handling, so it propagates as a genuine unexpected error rather than
   * silently becoming "incorrect."
   *
   * Throws `InvalidSelectedAnswerError` (via `evaluateAnswerCorrectness`)
   * for a structurally malformed CLIENT `selectedAnswer` — a
   * request-validation error `submit-answer.ts` DOES catch explicitly and
   * maps to `SubmitAnswerResult.INVALID_SELECTED_ANSWER`.
   */
  async isCorrect(
    questionVersionId: string,
    selectedAnswer: SelectedAnswer,
  ): Promise<boolean> {
    const result = await this.db.query(
      "select question_type, answer_options, correct_answer from question_versions where id = $1",
      [questionVersionId],
    );
    if (result.rows.length !== 1) {
      // submit-answer.ts always validates questionVersionId's existence
      // (via QuestionVersionRepository.resolveVersionContext) before ever
      // calling this method, so reaching here means a real bug — surfaced
      // loudly, never silently treated as "incorrect."
      throw new Error(
        `PostgresAnswerCorrectnessChecker.isCorrect: no question_versions row found for id=${questionVersionId}`,
      );
    }

    const definition = mapQuestionAnswerDefinitionRow(result.rows[0]);
    assertValidQuestionAnswerDefinition(definition);

    return evaluateAnswerCorrectness(definition, selectedAnswer);
  }
}
