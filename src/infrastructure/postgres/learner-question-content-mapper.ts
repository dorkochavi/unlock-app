/**
 * Row <-> domain mapping for the learner-facing subset of
 * `question_versions` — this slice's dedicated, `correct_answer`-free read
 * path (see `LearnerQuestionContentRepository`'s own doc comment,
 * `src/application/learning/ports.ts`).
 *
 * Reads ONLY `id`, `question_type`, `prompt`, `answer_options` from the
 * row. Reuses `readAnswerOptions` from `question-answer-definition-mapper
 * .ts` (the same option-shape validation already trusted for the grading
 * read path) instead of re-implementing it — that function never touches
 * `correct_answer` either, so sharing it introduces no leak risk. Nothing
 * in this file imports, reads, or references `correct_answer` or
 * `explanation` in any way.
 */
import { QUESTION_TYPES } from "../../domain/learning/answer";
import type { LearnerQuestionContent } from "../../application/learning/ports";
import { readAnswerOptions } from "./question-answer-definition-mapper";
import { readEnum, readString } from "./row-validation";

const TABLE = "question_versions";

export function mapLearnerQuestionContentRow(
  row: Record<string, unknown>,
): LearnerQuestionContent {
  return {
    questionVersionId: readString(row, TABLE, "id"),
    questionType: readEnum(row, TABLE, "question_type", QUESTION_TYPES),
    prompt: readString(row, TABLE, "prompt"),
    options: readAnswerOptions(row.answer_options),
  };
}
