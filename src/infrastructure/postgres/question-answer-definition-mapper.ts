/**
 * Explicit row <-> domain mapping for `question_versions`' answer-content
 * columns (ADR-014). Deliberately its own small mapper, not folded into a
 * general QuestionVersion mapper — no such general mapper exists, because
 * nothing in this codebase currently needs a "full QuestionVersion" domain
 * object (`QuestionVersionRepository`'s existing methods return narrow
 * id-only shapes; see ADR-014 Decision §6 for why this stays that way).
 */
import {
  QUESTION_TYPES,
  type AnswerOption,
  type QuestionAnswerDefinition,
} from "../../domain/learning/answer";
import { MalformedRowError, readEnum } from "./row-validation";

const TABLE = "question_versions";

/**
 * Exported so `learner-question-content-mapper.ts` (this codebase's
 * dedicated learner-facing, `correct_answer`-free read path) can reuse the
 * exact same `answer_options` shape validation without duplicating it —
 * this function never touches `correct_answer`, so sharing it introduces no
 * risk of that field leaking into the learner-facing mapper.
 */
export function readAnswerOptions(value: unknown): AnswerOption[] {
  if (!Array.isArray(value)) {
    throw new MalformedRowError(
      TABLE,
      "answer_options",
      `expected a JSON array, got ${JSON.stringify(value)}`,
    );
  }
  return value.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      typeof (entry as Record<string, unknown>).id !== "string" ||
      typeof (entry as Record<string, unknown>).content !== "string"
    ) {
      throw new MalformedRowError(
        TABLE,
        "answer_options",
        `element ${index} is not a valid {id: string, content: string} object, got ${JSON.stringify(entry)}`,
      );
    }
    const option = entry as Record<string, unknown>;
    return { id: option.id as string, content: option.content as string };
  });
}

function readCorrectOptionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new MalformedRowError(
      TABLE,
      "correct_answer",
      `expected a JSON array, got ${JSON.stringify(value)}`,
    );
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new MalformedRowError(
        TABLE,
        "correct_answer",
        `element ${index} is not a string option id, got ${JSON.stringify(entry)}`,
      );
    }
    return entry;
  });
}

/**
 * Parses+shape-validates a raw `question_versions` row into a
 * `QuestionAnswerDefinition`. Only validates JSON SHAPE (is this a
 * well-formed array of options / array of id strings) — cross-field
 * semantic validation (unique ids, correctOptionIds referencing real
 * options, per-type cardinality) is `assertValidQuestionAnswerDefinition`'s
 * job (`src/domain/learning/answer.ts`), called separately by
 * `PostgresAnswerCorrectnessChecker` so the two concerns (JSON shape vs.
 * domain rules) stay in the layer each actually belongs to.
 */
export function mapQuestionAnswerDefinitionRow(
  row: Record<string, unknown>,
): QuestionAnswerDefinition {
  return {
    questionType: readEnum(row, TABLE, "question_type", QUESTION_TYPES),
    options: readAnswerOptions(row.answer_options),
    correctOptionIds: readCorrectOptionIds(row.correct_answer),
  };
}
